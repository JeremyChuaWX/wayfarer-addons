// ==UserScript==
// @name         Wayfarer Layout Mod
// @version      0.1.0
// @description  Restores the layout to be more similar to the old layout
// @namespace    https://gitlab.com/Tntnnbltn/wayfarer-addons
// @downloadURL  https://gitlab.com/Tntnnbltn/wayfarer-addons/-/raw/main/wayfarer-layout-mod.user.js
// @homepageURL  https://gitlab.com/Tntnnbltn/wayfarer-addons
// @match        https://wayfarer.scopely.com/*
// @run-at       document-start
// ==/UserScript==

function init() {

    let changed = false;

    /**
     * Overwrite the open method of the XMLHttpRequest.prototype to intercept the server calls
     */
    (function (open) {
        XMLHttpRequest.prototype.open = function (method, url) {
            if (url == '/api/v1/vault/review' && method == 'GET') {
                this.addEventListener('load', modifyNewReview, false);
            }
            open.apply(this, arguments);
        };
    })(XMLHttpRequest.prototype.open);

    const awaitElement = get => new Promise((resolve, reject) => {
        let triesLeft = 10;
        const queryLoop = () => {
            const ref = get();
            if (ref) resolve(ref);
            else if (!triesLeft) reject();
            else setTimeout(queryLoop, 100);
            triesLeft--;
        }
        queryLoop();
    });

    function modifyNewReview() {
        changed = false;
        checkElements();
    }

    // Function to check if the main container and the required elements are available
    function checkElements() {
        var mainContainer = document.querySelector('app-review-new-b');
        var titleAndDescription = mainContainer ? mainContainer.querySelector('app-title-and-description-b') : null;
        var photo = mainContainer ? mainContainer.querySelector('app-photo-b') : null;
        var supportingInfo = mainContainer ? mainContainer.querySelector('app-supporting-info-b') : null;
        var checkDuplicates = mainContainer ? mainContainer.querySelector('app-check-duplicates-b') : null;
        var questionsContainer = mainContainer ? mainContainer.querySelector('.review-questions') : null;
        var categorizationCard = mainContainer ? mainContainer.querySelector('#categorization-card') : null;

        // If all required elements are available, proceed with reorganization
        if (mainContainer && titleAndDescription && photo && supportingInfo && checkDuplicates && questionsContainer && categorizationCard && !changed) {
            // Create a new container for the top row
            var topRowContainer = document.createElement('div');
            topRowContainer.classList.add('top-row-container');
            // Set the display property to flex to ensure the children are in a single horizontal row
            topRowContainer.style.display = 'flex';

            // Set the flex property for each child to 1
            titleAndDescription.style.flex = '1';
            photo.style.flex = '1';
            supportingInfo.style.flex = '1';
            supportingInfo.style.maxWidth = '450px';
            // Enable overflow wrap for the supportingInfo element
            supportingInfo.style.overflowWrap = 'break-word';

            // Set the max height of images within the Photo and Supporting cards to 300 pixels
            var photoImage = photo.querySelector('img');
            var supportingImage = supportingInfo.querySelector('img');

            if (photoImage) {
                photoImage.style.maxHeight = '400px';
                photoImage.style.height = 'auto';
                photoImage.style.display = 'block'; // Ensure the image is displayed as a block
                photoImage.style.margin = 'auto'; // Center the image horizontally
            }

            if (supportingImage) {
                supportingImage.style.maxHeight = '350px';
                photoImage.style.height = 'auto';
                supportingImage.style.display = 'block'; // Ensure the image is displayed as a block
                supportingImage.style.margin = 'auto'; // Center the image horizontally
            }

            // Set the height of each wf-review-card to 100%
            var titleDescCard = titleAndDescription.querySelector('.wf-review-card');
            var photoCard = photo.querySelector('.wf-review-card-b');
            var supportingCard = supportingInfo.querySelector('.wf-review-card-b');

            if (titleDescCard) {
                titleDescCard.style.height = '100%';
            }

            if (photoCard) {
                photoCard.style.height = '100%';
            }

            if (supportingCard) {
                supportingCard.style.height = '100%';
            }

            // Append title and description, photo, and supporting information to the top row container
            topRowContainer.appendChild(titleAndDescription);
            topRowContainer.appendChild(photo);
            topRowContainer.appendChild(supportingInfo);

            // Get the parent of questionsContainer
            var parentOfQuestions = questionsContainer.parentNode;

            // Insert the top row container before the questionsContainer
            parentOfQuestions.insertBefore(topRowContainer, questionsContainer);

            // Create a new container for the bottom row with two columns
            var bottomRowContainer = document.createElement('div');
            bottomRowContainer.classList.add('bottom-row-container');
            // Set the display property to flex to ensure the children are in a single horizontal row
            bottomRowContainer.style.display = 'flex';

            // Create a new container for the left column within the bottom row
            var leftColumnContainer = document.createElement('div');
            leftColumnContainer.classList.add('left-column-container');
            // Set the flex property for the left column to 1
            leftColumnContainer.style.flex = '1';
            leftColumnContainer.style.maxWidth = '630px';

            // Add 20 pixels of padding between the left and right columns of the bottom row
            leftColumnContainer.style.marginRight = '20px';

            // Append duplicates map and review-category-card to the left column container
            leftColumnContainer.appendChild(checkDuplicates);
            leftColumnContainer.appendChild(categorizationCard);

            // Set the flex property for the questionsContainer to 1
            questionsContainer.style.flex = '1';

            // Add 20 pixels of padding underneath the top row
            leftColumnContainer.style.marginTop = '20px';
            questionsContainer.style.marginTop = '20px';

            // Append left column and questions to the bottom row container
            bottomRowContainer.appendChild(leftColumnContainer);
            bottomRowContainer.appendChild(questionsContainer);

            // Append the bottom row container to the main container
            mainContainer.appendChild(bottomRowContainer);

            // Append the street address after the description text
            var streetAddressContainer = photo.querySelector('.mt-2');
            var descriptionTextContainer = titleAndDescription.querySelector('.mt-4.text-lg');
            var parentContainer = descriptionTextContainer.parentNode;

            if (streetAddressContainer && descriptionTextContainer && parentContainer) {
                // Create a new div for the street address
                var streetAddressDiv = document.createElement('div');
                streetAddressDiv.classList.add('street-address-container');

                // Move street address to the new div
                streetAddressDiv.appendChild(streetAddressContainer);

                // Set the font size for the street address text
                streetAddressContainer.style.fontSize = '12px'; // Adjust the font size as needed

                // Prevent street address from inheriting text-lg line-height
                streetAddressContainer.style.lineHeight = 'initial';

                // Append the new div to the parent container
                parentContainer.appendChild(streetAddressDiv);

                // Apply flex styles to the parent container
                parentContainer.style.display = 'flex';
                parentContainer.style.flexDirection = 'column';
                parentContainer.style.justifyContent = 'space-between';

                // Apply styles to the street address div
                streetAddressDiv.style.marginTop = 'auto';
            }

            // Text formatting for supporting statemetn to deal with line breaks and width
            var supportingInfoStatement = document.querySelector('.supporting-info-statement');
            if (!supportingInfoStatement) {
                supportingInfoStatement = document.querySelector('.cursor-pointer.ng-star-inserted');
            }
            if (supportingInfoStatement) {
            supportingInfoStatement.style.lineBreak = 'normal';
            supportingInfoStatement.style.maxWidth = '380px';
            }

            // Remove the additional category selection menu
            // var wfSelectElement = categorizationCard.querySelector('wf-select.review-categorization.ng-star-inserted');
            // if (wfSelectElement) {
            //     wfSelectElement.remove();
            // }

            var categoryCards = document.querySelectorAll('.wf-review-card.review-category-card');
            categoryCards.forEach(function (card) {
                card.style.paddingBottom = '0';
                card.style.minHeight = '350px';
            });

            // Remove the height: 100% style from elements with the class wf-review-card--map
            var mapCards = document.querySelectorAll('.wf-review-card--map');
            mapCards.forEach(function (card) {
                card.style.height = 'auto';
            });

            // SPLIT REVIEW CATEGORY INTO TWO COLUMNS FOR SPACING
            // Find the review-categorization container
            var reviewCategorizationContainer = document.querySelector('.review-categorization');

            if (reviewCategorizationContainer) {
                // Find the wf-select element within reviewCategorizationContainer
                var wfSelectElement = reviewCategorizationContainer.querySelector('wf-select.review-categorization.ng-star-inserted');

                if (wfSelectElement) {
                    // Create the left column
                    var categorizationLeft = document.createElement('div');
                    categorizationLeft.className = 'categorization-left ' + reviewCategorizationContainer.className;
                    categorizationLeft.style.marginRight = '20px';

                    // Get the parent of reviewCategorizationContainer
                    var parentOfReviewCategorization = reviewCategorizationContainer.parentNode;

                    // Move the content from reviewCategorizationContainer to categorizationLeft
                    while (reviewCategorizationContainer.firstChild !== wfSelectElement) {
                        categorizationLeft.appendChild(reviewCategorizationContainer.firstChild);
                    }

                    // Insert categorizationLeft before reviewCategorizationContainer
                    parentOfReviewCategorization.insertBefore(categorizationLeft, reviewCategorizationContainer);
                }
            }

            // Remove an unwanted div
            var nominationInfoDiv = mainContainer.querySelector('.flex-col');
            if (nominationInfoDiv) {
                nominationInfoDiv.remove();
            }

            // Select all buttons with the class 'dont-know-button'
            var dontKnowButtons = document.querySelectorAll('.dont-know-button');

            // Iterate over each button and replace the text
            dontKnowButtons.forEach(function (button) {
                button.textContent = 'IDK';
                button.style.minWidth = 'unset';
            });

            // Add "Rejection Criteria" as the text for the first h4 element
            var h4Element = questionsContainer.querySelector('h4');
            if (h4Element) {
                h4Element.textContent = "Rejection Criteria";
            }

            // Remove the unwanted paragraph element
            var descriptionParagraph = questionsContainer.querySelector('p');
            if (descriptionParagraph) {
                descriptionParagraph.remove();
            }

            // Add "Eligibility Criteria" heading after the 4th question card
            var questionCards = questionsContainer.querySelectorAll('app-question-card');
            if (questionCards.length >= 4) {
                var eligibilityCriteriaHeading = document.createElement('h4');
                eligibilityCriteriaHeading.textContent = 'Eligibility Criteria';

                // Add padding above and below the h4 element
                eligibilityCriteriaHeading.style.marginTop = '10px';
                eligibilityCriteriaHeading.style.marginBottom = '10px';

                // Insert the h4 element before the 5th question card
                questionsContainer.insertBefore(eligibilityCriteriaHeading, questionCards[4]);
            }

            // THIS IS CODE TO MOVE THE SUBMIT BUTTON TO THE GAP IN THE RIGHT COLUMN
            // NOT USED CURRENTLY BECAUSE IT MAKES THE ADD-ONS RED BUTTON DISAPPEAR
            //var actionButtonContainer = document.querySelector('.flex.justify-center.mt-8.ng-star-inserted');
            //if (actionButtonContainer && questionsContainer) {
            //    questionsContainer.appendChild(actionButtonContainer);
            //}

            changed = true;

            // Disconnect the observer after the reorganization is complete
            observer.disconnect();
        } else {
            // If any required element is missing, wait and check again
            setTimeout(checkElements, 100);
        }
    }

    // Use a MutationObserver to detect changes in the DOM
    var observer = new MutationObserver(checkElements);

    // Start observing changes in the body of the document
    observer.observe(document.body, { childList: true, subtree: true });

    // Call the checkElements function initially
    checkElements();

}

init();
