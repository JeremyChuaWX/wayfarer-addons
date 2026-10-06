/**
 * Wayfarer Ticket Manager — cross-device sync backend.
 *
 * Stores Ticket Manager sessions in a private JSON file in the deploying
 * account's Google Drive.
 *
 * Deploy as a Web app:
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Keep the deployed /exec URL private.
 */

const WFTM_SYNC_API_VERSION = 1;
const WFTM_SYNC_STORE_VERSION = 1;
const WFTM_SYNC_MAX_OPERATIONS = 250;
const WFTM_SYNC_MAX_SESSION_CHARACTERS = 50000;
const WFTM_SYNC_MAX_APPLIED_OPERATIONS = 5000;
const WFTM_SYNC_LOCK_TIMEOUT_MS = 30000;
const WFTM_SYNC_STORE_NAME = 'Wayfarer Ticket Manager Sync.json';

const WFTM_SYNC_FILE_ID_PROPERTY = 'WFTM_SYNC_FILE_ID';

/**
 * Clears all synced records and tombstones.
 */
function resetTicketSyncData() {
  const lock = LockService.getScriptLock();
  lock.waitLock(WFTM_SYNC_LOCK_TIMEOUT_MS);
  try {
    writeStore_(createEmptyStore_());
  } finally {
    lock.releaseLock();
  }
  Logger.log('Ticket Manager Sync data reset.');
}

/**
 * A harmless endpoint check. Ticket data is never returned through GET because
 * browsers and intermediary logs commonly retain query strings.
 */
function doGet() {
  return jsonOutput_({
    ok: true,
    version: WFTM_SYNC_API_VERSION,
    service: 'Wayfarer Ticket Manager Sync',
  });
}

function doPost(e) {
  try {
    const rawPayload = String((e && e.parameter && e.parameter.payload) || '');
    if (!rawPayload) throw new Error('Missing payload.');

    let request;
    try {
      request = JSON.parse(rawPayload);
    } catch (error) {
      throw new Error('Payload is not valid JSON.');
    }

    validateRequest_(request);
    return jsonOutput_(sync_(request));
  } catch (error) {
    return jsonOutput_({
      ok: false,
      version: WFTM_SYNC_API_VERSION,
      error: {
        message: error && error.message ? error.message : String(error),
      },
    });
  }
}

function validateRequest_(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw new Error('Invalid request.');
  }
  if (Number(request.version) !== WFTM_SYNC_API_VERSION) {
    throw new Error('API version mismatch.');
  }
  if (!Number.isInteger(request.sinceRevision) || request.sinceRevision < 0) {
    throw new Error('Invalid sync revision.');
  }
  if (!Array.isArray(request.operations)) {
    throw new Error('Operations must be an array.');
  }
  if (request.operations.length > WFTM_SYNC_MAX_OPERATIONS) {
    throw new Error('Too many operations in one sync request.');
  }
}

/**
 * Applies client operations and returns records changed since the client's
 * last successful revision. A full snapshot is returned for first syncs and
 * after the remote store has been reset.
 */
function sync_(request) {
  const operations = request.operations;
  const sinceRevision = request.sinceRevision;
  const lock = LockService.getScriptLock();
  lock.waitLock(WFTM_SYNC_LOCK_TIMEOUT_MS);

  try {
    const store = readStore_();
    const full = sinceRevision === 0 || sinceRevision > store.revision;
    const results = [];

    operations.forEach(operation => {
      validateOperation_(operation);

      const prior = store.appliedOps[operation.id];
      if (prior) {
        results.push({
          id: operation.id,
          aui: operation.aui,
          status: 'duplicate',
          revision: Number(prior.revision) || store.revision,
        });
        return;
      }

      const current = store.records[operation.aui] || null;
      let status = 'ignored';
      let resultRevision = current ? Number(current.revision) || 0 : 0;

      if (operation.type === 'delete') {
        if (current && current.deleted === true) {
          status = 'already-deleted';
        } else {
          store.revision += 1;
          resultRevision = store.revision;
          store.records[operation.aui] = {
            deleted: true,
            revision: resultRevision,
          };
          status = 'deleted';
        }
      } else {
        const force = operation.force === true;
        const baseRevision = Number(operation.baseRevision) || 0;

        if (current && current.deleted === true && !force) {
          status = 'tombstoned';
        } else if (current && baseRevision < Number(current.revision || 0) && !force) {
          status = 'stale';
        } else {
          store.revision += 1;
          resultRevision = store.revision;
          store.records[operation.aui] = {
            deleted: false,
            revision: resultRevision,
            session: cloneSession_(operation.session),
          };
          status = current && current.deleted === true ? 'resurrected' : 'saved';
        }
      }

      store.appliedOps[operation.id] = {
        revision: resultRevision,
        status: status,
        appliedAt: new Date().toISOString(),
      };
      results.push({
        id: operation.id,
        aui: operation.aui,
        status: status,
        revision: resultRevision,
      });
    });

    pruneAppliedOperations_(store);
    if (operations.length > 0) writeStore_(store);

    const changes = {};
    Object.keys(store.records).forEach(aui => {
      const record = store.records[aui];
      if (full || Number(record && record.revision) > sinceRevision) {
        changes[aui] = record;
      }
    });

    return {
      ok: true,
      version: WFTM_SYNC_API_VERSION,
      revision: store.revision,
      full: full,
      results: results,
      changes: changes,
    };
  } finally {
    lock.releaseLock();
  }
}

function validateOperation_(operation) {
  if (!operation || typeof operation !== 'object' || Array.isArray(operation)) {
    throw new Error('Invalid operation.');
  }
  if (
    typeof operation.id !== 'string' ||
    !operation.id.trim() ||
    isUnsafeObjectKey_(operation.id)
  ) {
    throw new Error('Operation is missing or has an invalid id.');
  }
  if (operation.type !== 'upsert' && operation.type !== 'delete') {
    throw new Error('Invalid operation type.');
  }
  if (
    typeof operation.aui !== 'string' ||
    !operation.aui.trim() ||
    isUnsafeObjectKey_(operation.aui)
  ) {
    throw new Error('Invalid session identifier.');
  }

  if (operation.type === 'upsert') {
    const baseRevision = Number(operation.baseRevision);
    if (!Number.isInteger(baseRevision) || baseRevision < 0) {
      throw new Error('Invalid base revision.');
    }
    if (operation.force !== undefined && typeof operation.force !== 'boolean') {
      throw new Error('Invalid force flag.');
    }
    validateSession_(operation.session);
  }
}

function validateSession_(session) {
  if (!session || typeof session !== 'object' || Array.isArray(session)) {
    throw new Error('Invalid session data.');
  }
  if (typeof session.di !== 'string' || !session.di.trim()) {
    throw new Error('Session is missing its DI value.');
  }
  if (
    session.asi !== undefined &&
    session.asi !== null &&
    typeof session.asi !== 'string'
  ) {
    throw new Error('Session ASI value is invalid.');
  }
  if (session.inProgress !== undefined && typeof session.inProgress !== 'boolean') {
    throw new Error('Session inProgress value is invalid.');
  }
  if (session.type !== undefined && session.type !== null && typeof session.type !== 'string') {
    throw new Error('Session type is invalid.');
  }
  if (session.wayspot !== undefined && session.wayspot !== null && typeof session.wayspot !== 'string') {
    throw new Error('Session Wayspot is invalid.');
  }

  const encoded = JSON.stringify(session);
  if (encoded.length > WFTM_SYNC_MAX_SESSION_CHARACTERS) {
    throw new Error('Session data is unexpectedly large.');
  }
}

function createEmptyStore_() {
  return {
    version: WFTM_SYNC_STORE_VERSION,
    revision: 0,
    records: {},
    appliedOps: {},
  };
}

function readStore_() {
  const file = getStoreFile_();

  let raw;
  try {
    raw = file.getBlob().getDataAsString('UTF-8');
  } catch (error) {
    throw new Error('Ticket Sync data file could not be opened.');
  }

  let store;
  try {
    store = JSON.parse(raw);
  } catch (error) {
    throw new Error('The Ticket Sync data file contains invalid JSON.');
  }

  if (!store || typeof store !== 'object' || Array.isArray(store)) {
    throw new Error('The Ticket Sync data file is invalid.');
  }
  const storeVersion = Number(store.version);
  if (storeVersion !== WFTM_SYNC_STORE_VERSION) {
    throw new Error('Ticket Sync data version mismatch.');
  }

  store.revision = Number.isInteger(store.revision) && store.revision >= 0
    ? store.revision
    : 0;
  store.records = isPlainObject_(store.records) ? store.records : {};
  store.appliedOps = isPlainObject_(store.appliedOps) ? store.appliedOps : {};
  return store;
}

function writeStore_(store) {
  getStoreFile_().setContent(JSON.stringify(store, null, 2));
}

function getStoreFile_() {
  const properties = PropertiesService.getScriptProperties();
  const fileId = properties.getProperty(WFTM_SYNC_FILE_ID_PROPERTY);

  if (fileId) {
    try {
      return DriveApp.getFileById(fileId);
    } catch (error) {
      throw new Error('Ticket Sync data file could not be opened.');
    }
  }

  const file = DriveApp.createFile(
    WFTM_SYNC_STORE_NAME,
    JSON.stringify(createEmptyStore_(), null, 2),
    MimeType.PLAIN_TEXT
  );
  properties.setProperty(WFTM_SYNC_FILE_ID_PROPERTY, file.getId());
  return file;
}

function pruneAppliedOperations_(store) {
  const ids = Object.keys(store.appliedOps);
  if (ids.length <= WFTM_SYNC_MAX_APPLIED_OPERATIONS) return;

  ids.sort((left, right) => {
    const a = String((store.appliedOps[left] && store.appliedOps[left].appliedAt) || '');
    const b = String((store.appliedOps[right] && store.appliedOps[right].appliedAt) || '');
    return a.localeCompare(b);
  });

  const removeCount = ids.length - WFTM_SYNC_MAX_APPLIED_OPERATIONS;
  ids.slice(0, removeCount).forEach(id => delete store.appliedOps[id]);
}

function cloneSession_(session) {
  return JSON.parse(JSON.stringify(session));
}

function isPlainObject_(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function isUnsafeObjectKey_(key) {
  return key === '__proto__' || key === 'prototype' || key === 'constructor';
}

function jsonOutput_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
