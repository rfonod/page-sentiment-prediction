// Apply changes to the pop-up window according to the predicted sentiment
function changes(icon_path, sentiment, feeling, color) {
    let percent = Math.round(Math.abs(sentiment) * 100);
    let text = `<i>Overal page sentiment</i>:<br><strong>${feeling} (${percent}%)</strong>`;

    document.getElementById('iconID').src = icon_path;
    document.getElementById("textID").innerHTML = text;
    document.body.style.backgroundColor = color;
}

// Convert the predicted sentiment, from interval [-1,1] to [0, 100], where:
//      Negative sentiments: [-1,0] -> [0, 50]
//      Positive sentiments:  (0,1] -> (50,100]
function getPercent(sentiment) {
    if (sentiment > 0) {
        return ((sentiment * 100) / 2) + 50;

    } else if (sentiment <= 0) {
        return 50 - ((Math.abs(sentiment) * 100) / 2);
    }
}

// Convert the above "percentage" representation of the sentiment to a HEX color code
function percentToColor(percent) {
    let r, g, b = 0;
    if (percent < 50) {
        r = 255;
        g = Math.round(5.1 * percent);
    } else {
        g = 255;
        r = Math.round(510 - 5.10 * percent);
    }
    let h = r * 0x10000 + g * 0x100 + b * 0x1;
    return '#' + ('000000' + h.toString(16)).slice(-6);
}

// Define pop-up window changes according to the predicted sentiment
function updatePopUp(sentiment) {
    let newColor = percentToColor(getPercent(sentiment));

    if (sentiment > 0.8) {
        changes('../icons/extraExtraHappy.png', sentiment, 'Extremely positive', newColor);
    } else if (sentiment > 0.5 && sentiment <= 0.8) {
        changes('../icons/extraHappy.png', sentiment, 'Very positive', newColor);
    } else if (sentiment > 0.15 && sentiment <= 0.5) {
        changes('../icons/happy.png', sentiment, 'Positive', newColor);
    } else if (sentiment > 0 && sentiment <= 0.15) {
        changes('../icons/neutral.png', sentiment, 'Slightly positive', newColor);
    } else if (sentiment >= -0.15 && sentiment <= 0) {
        changes('../icons/neutral.png', sentiment, 'Slightly negative', newColor);
    } else if (sentiment < -0.15 && sentiment >= -0.5) {
        changes('../icons/unhappy.png', sentiment, 'Negative', newColor);
    } else if (sentiment < -0.5 && sentiment >= -0.8) {
        changes('../icons/extraUnhappy.png', sentiment, 'Very negative', newColor);
    } else if (sentiment < -0.8) {
        changes('../icons/extraExtraUnhappy.png', sentiment, 'Extremely negative', newColor);
    }
}

// Call back-end to predict the page sentiment of the active tab 
getSentiment();

// When the button is clicked, show or hide 3 positive sentence examples from the page
document.addEventListener('DOMContentLoaded', function() {
    var checkPageButtonPos = document.getElementById('clickItPos');
    checkPageButtonPos.addEventListener('click', function() {
        if (document.getElementById("pos1ID").innerHTML == '') {
            chrome.tabs.getSelected(null, function(tab) {
                // show positive examples
                document.getElementById("pos1ID").innerHTML = pos_examples[0];
                document.getElementById("pos2ID").innerHTML = pos_examples[1];
                document.getElementById("pos3ID").innerHTML = pos_examples[2];
            });
        } else {
            chrome.tabs.getSelected(null, function(tab) {
                // hide positive examples
                document.getElementById("pos1ID").innerHTML = '';
                document.getElementById("pos2ID").innerHTML = '';
                document.getElementById("pos3ID").innerHTML = '';
            });
        }
    }, false);
}, false);

// When the button is clicked, show or hide 3 negative sentence examples from the page
document.addEventListener('DOMContentLoaded', function() {
    var checkPageButtonNeg = document.getElementById('clickItNeg');
    checkPageButtonNeg.addEventListener('click', function() {
        if (document.getElementById("neg1ID").innerHTML == '') {
            chrome.tabs.getSelected(null, function(tab) {
                // show negative examples
                document.getElementById("neg1ID").innerHTML = neg_examples[0];
                document.getElementById("neg2ID").innerHTML = neg_examples[1];
                document.getElementById("neg3ID").innerHTML = neg_examples[2];
            });
        } else {
            chrome.tabs.getSelected(null, function(tab) {
                // hide negative examples
                document.getElementById("neg1ID").innerHTML = '';
                document.getElementById("neg2ID").innerHTML = '';
                document.getElementById("neg3ID").innerHTML = '';
            });
        }
    }, false);
}, false);