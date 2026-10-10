// ==UserScript==
// @name         Wayfarer Layout Mod
// @version      0.2.0
// @description  Restores the layout to be more similar to the old layout
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-layout-mod.user.js
// @updateURL    https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-layout-mod.user.js
// @homepageURL  https://gitlab.com/Tntnnbltn/wayfarer-addons
// @match        https://wayfarer.scopely.com/*
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // Only one scheduled check may exist, and only following a successful native
    // review response. No MutationObserver (Angular/Zone.js can react to its
    // callbacks during review rendering), requestAnimationFrame loop, or map work.
    let pendingCheck = null;
    let reviewGeneration = 0;

    function cancelPendingCheck() {
        reviewGeneration++;
        if (pendingCheck !== null) clearTimeout(pendingCheck);
        pendingCheck = null;
    }

    function applyLayout() {
        const review = document.querySelector('app-review-new-b');
        const layout = review?.querySelector('.review-new');
        if (!layout) return false; // Other review types, or review not rendered yet.

        const title = layout.querySelector('app-title-and-description-b');
        const photo = layout.querySelector('app-photo-b');
        const supporting = layout.querySelector('app-supporting-info-b'); // Optional in native build.
        const duplicates = layout.querySelector('app-check-duplicates-b');
        const questions = layout.querySelector('.review-questions');
        const categorization = layout.querySelector('#categorization-card');
        if (!title || !photo || !duplicates || !questions || !categorization) return false;

        // The original mod placed the bottom row outside this grid; avoid an extra native 2rem row gap.
        layout.style.rowGap = '0';

        // Reuse existing containers if Angular has updated the current review in place.
        // All created containers live INSIDE the native ngIf view, so its destruction
        // also cleans up the layout mod's elements.
        let top = layout.querySelector('.top-row-container');
        let bottom = layout.querySelector('.bottom-row-container');
        let left = layout.querySelector('.left-column-container');
        if (!top) {
            top = document.createElement('div');
            top.className = 'top-row-container';
            top.style.display = 'flex';
            top.style.gridColumn = '1 / -1';
            questions.parentNode.insertBefore(top, questions);
        }
        if (!bottom) {
            bottom = document.createElement('div');
            bottom.className = 'bottom-row-container';
            bottom.style.display = 'flex';
            bottom.style.gridColumn = '1 / -1';
            layout.appendChild(bottom);
        }
        if (!left) {
            left = document.createElement('div');
            left.className = 'left-column-container';
            left.style.flex = '1';
            left.style.maxWidth = '630px';
            left.style.marginRight = '20px';
            left.style.marginTop = '20px';
            bottom.appendChild(left);
        }

        title.style.flex = '1';
        photo.style.flex = '1';
        if (title.parentNode !== top) top.appendChild(title);
        if (photo.parentNode !== top) top.appendChild(photo);
        if (supporting) {
            supporting.style.flex = '1';
            supporting.style.maxWidth = '450px';
            supporting.style.overflowWrap = 'break-word';
            if (supporting.parentNode !== top) top.appendChild(supporting);
        }

        if (duplicates.parentNode !== left) left.appendChild(duplicates);
        if (categorization.parentNode !== left) left.appendChild(categorization);
        questions.style.flex = '1';
        questions.style.marginTop = '20px';
        if (questions.parentNode !== bottom) bottom.appendChild(questions);

        const photoImage = photo.querySelector('img');
        if (photoImage) {
            photoImage.style.maxHeight = '400px';
            photoImage.style.height = 'auto';
            photoImage.style.display = 'block';
            photoImage.style.margin = 'auto';
        }
        const supportingImage = supporting?.querySelector('img');
        if (supportingImage) {
            supportingImage.style.maxHeight = '350px';
            supportingImage.style.height = 'auto';
            supportingImage.style.display = 'block';
            supportingImage.style.margin = 'auto';
        }

        for (const element of [
            title.querySelector('.wf-review-card'),
            photo.querySelector('.wf-review-card-b'),
            supporting?.querySelector('.wf-review-card-b')
        ]) {
            if (element) element.style.height = '100%';
        }

        // Keep the original address structure for external userscripts: they may
        // insert arbitrary elements immediately before/after the native address.
        // In Wayfarer 5.50.0 the photo card body has a [wf-image-modal] element
        // followed by the native .mt-2 street-address div. Carry ALL elements
        // following the image into the title card, without recognising add-ons.
        const description = title.querySelector('.mt-4.text-lg');
        const addressParent = description?.parentElement;
        const existingAddressBox = title.querySelector('.street-address-container');
        const imageHost = photo.querySelector('[wf-image-modal]');
        const photoBody = imageHost?.parentElement;
        const scopeAttribute = imageHost?.getAttributeNames().find(name => name.startsWith('_ngcontent-'));
        // Prefer the native Angular address when other add-ons also use .mt-2.
        const nativeAddress = photoBody && Array.from(photoBody.children).find(element =>
            element !== imageHost && element.classList.contains('mt-2') &&
            (!scopeAttribute || element.hasAttribute(scopeAttribute))
        );
        const address = nativeAddress || existingAddressBox?.querySelector('.mt-2') || photo.querySelector('.mt-2');
        if (addressParent && address) {
            const addressBox = existingAddressBox || document.createElement('div');
            if (!existingAddressBox) addressBox.className = 'street-address-container';

            if (address.parentElement !== addressBox) {
                const source = address.parentElement;
                if (imageHost?.parentElement === source) {
                    // A snapshot is essential because appendChild moves live nodes.
                    // Leave the native photo/image element (and anything before it)
                    // untouched. Preserve all added siblings surrounding the address.
                    const siblings = Array.from(source.children);
                    const imageIndex = siblings.indexOf(imageHost);
                    const addressIndex = siblings.indexOf(address);
                    if (imageIndex !== -1 && addressIndex > imageIndex) {
                        for (const sibling of siblings.slice(imageIndex + 1)) {
                            addressBox.appendChild(sibling);
                        }
                    } else {
                        addressBox.appendChild(address);
                    }
                } else {
                    addressBox.appendChild(address);
                }
            }
            if (addressBox.parentElement !== addressParent) addressParent.appendChild(addressBox);

            address.style.fontSize = '12px';
            address.style.lineHeight = 'initial';
            addressParent.style.display = 'flex';
            addressParent.style.flexDirection = 'column';
            addressParent.style.justifyContent = 'space-between';
            addressBox.style.marginTop = 'auto';
        }

        const supportingStatement = layout.querySelector('.supporting-info-statement') ||
            supporting?.querySelector('.cursor-pointer.ng-star-inserted');
        if (supportingStatement) {
            supportingStatement.style.lineBreak = 'normal';
            supportingStatement.style.maxWidth = '380px';
        }

        layout.querySelectorAll('.wf-review-card.review-category-card').forEach(card => {
            card.style.paddingBottom = '0';
            card.style.minHeight = '350px';
        });
        layout.querySelectorAll('.wf-review-card--map').forEach(card => {
            card.style.height = 'auto';
        });

        // Split review categorization into two columns (original layout behaviour).
        const categoryContainer = layout.querySelector('.review-categorization');
        const categorySelect = categoryContainer?.querySelector('wf-select.review-categorization.ng-star-inserted');
        if (categoryContainer && categorySelect && categorySelect.parentNode === categoryContainer &&
            !categoryContainer.previousElementSibling?.classList.contains('categorization-left')) {
            const categoryLeft = document.createElement('div');
            categoryLeft.className = 'categorization-left ' + categoryContainer.className;
            categoryLeft.style.marginRight = '20px';
            while (categoryContainer.firstChild && categoryContainer.firstChild !== categorySelect) {
                categoryLeft.appendChild(categoryContainer.firstChild);
            }
            categoryContainer.parentNode.insertBefore(categoryLeft, categoryContainer);
        }

        // Remove the unused nomination-information wrapper after moving its cards.
        const emptyInfo = Array.from(layout.children).find(child => child.classList.contains('flex-col'));
        if (emptyInfo) emptyInfo.remove();

        layout.querySelectorAll('.dont-know-button').forEach(button => {
            button.textContent = 'IDK';
            button.style.minWidth = 'unset';
        });
        const rejectionHeading = questions.querySelector('h4');
        if (rejectionHeading) rejectionHeading.textContent = 'Rejection Criteria';
        const descriptionParagraph = questions.querySelector('p');
        if (descriptionParagraph) descriptionParagraph.remove();

        const questionCards = questions.querySelectorAll('app-question-card');
        if (questionCards.length >= 4 && !questions.querySelector('.wlm-eligibility-heading')) {
            const heading = document.createElement('h4');
            heading.className = 'wlm-eligibility-heading';
            heading.textContent = 'Eligibility Criteria';
            heading.style.marginTop = '10px';
            heading.style.marginBottom = '10px';
            questions.insertBefore(heading, questionCards[4]);
        }

        return true;
    }

    function watchReview() {
        // A newer API response cancels the prior review's outstanding check.
        cancelPendingCheck();
        const generation = reviewGeneration;
        let attempts = 0;

        function checkOnce() {
            if (generation !== reviewGeneration) return;
            pendingCheck = null;

            // Do nothing on other routes, or if Angular has removed the review.
            const reviewPage = document.querySelector('app-review');
            if (!reviewPage || reviewPage.querySelector('app-review-edit, app-review-photo')) return;

            // Never retry on an exception: unlike the old MutationObserver,
            // a malformed/unexpected review cannot trap the page in callbacks.
            try {
                if (applyLayout()) return;
            } catch (error) {
                console.warn('[Wayfarer Layout Mod] Could not apply review layout:', error);
                return;
            }

            // Allow asynchronous review/category rendering for up to eight
            // seconds. One timeout at a time, 250 ms apart, then stop entirely.
            if (++attempts < 32) pendingCheck = setTimeout(checkOnce, 250);
        }

        // Defer manipulation until after Angular processes this XHR response.
        pendingCheck = setTimeout(checkOnce, 125);
    }

    // Native ReviewModule calls HttpService.get(API.REVIEW) once per review.
    // XHR events let us make a single layout pass for the first and every next review.
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
        if (method === 'GET' && typeof url === 'string' &&
            /^(?:https:\/\/wayfarer\.scopely\.com)?\/api\/v1\/vault\/review(?:\?|$)/.test(url)) {
            this.addEventListener('load', () => {
                if (this.status >= 200 && this.status < 300) watchReview();
            }, false);
        }
        return originalOpen.apply(this, arguments);
    };
})();
