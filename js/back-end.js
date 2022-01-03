// Licence applicable to the TF model adopted for page sentiment prediction:

/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

// Initialize global variables
var model;
var metadataJSON;
var metadata;
var sentence_scores = [];
var web_content = [];
var updated = false;
var pos_examples = [[],[],[]];
var neg_examples = [[],[],[]];

// Load the TF model and its parameters to global variables
async function loadModel() {
    model = await tf.loadLayersModel('https://storage.googleapis.com/tfjs-models/tfjs/sentiment_cnn_v1/model.json');
    metadataJSON = await fetch('https://storage.googleapis.com/tfjs-models/tfjs/sentiment_cnn_v1/metadata.json');
    metadata = await metadataJSON.json();
}

// Pad each sentence to have a maximal length of metadata['max_len'] = 100 terms
async function padSequences(sequences, padding = 'pre', truncating = 'pre', value = 0) {
    // Function adopted from: https: //github.com/charlie-jones/YouTube-Comments-Analyzer
    return sequences.map(seq => {
        // Perform truncation.
        if (seq.length > metadata['max_len']) {
            if (truncating === 'pre') {
                seq.splice(0, seq.length - metadata['max_len']);
            } else {
                seq.splice(metadata['max_len'], seq.length - metadata['max_len']);
            }
        }
        // Perform padding
        if (seq.length < metadata['max_len']) {
            const pad = [];
            for (let i = 0; i < metadata['max_len'] - seq.length; ++i) {
                pad.push(value);
            }
            if (padding === 'pre') {
                seq = pad.concat(seq);
            } else {
                seq = seq.concat(pad);
            }
        }
        return seq;
    });
}

// Predict sentiment score from the input text, resulting interval: [0,1]
async function predict(text) {
    // Convert to lower case and remove all punctuations
    const inputText = text.trim().toLowerCase().replace(/(\.|\,|\!)/g, '').split(' ');
    // Tokenization, convert words to a sequence of word indices.
    const sequence = inputText.map(word => {
        var wdIndex = metadata['word_index'][word] + metadata['index_from'];
        if (wdIndex > metadata['vocabulary_size']) {
            wdIndex = 2;
        }
        return wdIndex;
    });
    // Perform truncation and padding
    const paddedSequence = await padSequences([sequence]);
    // Predict sentiment
    const input = tf.tensor2d(paddedSequence, [1, metadata['max_len']]);
    const predictOut = model.predict(input);
    // Obtain the prediction score
    const score = predictOut.dataSync()[0];
    predictOut.dispose();
    return score;
}

// Convert the prdicted score from interval [0,1] to [-1,1]
function scoreToInterval(prediction_score) {
    return 2 * (prediction_score - 0.5);
}

// Check if a sentence is all in upper case
function isUpperCase(str) {
    return str === str.toUpperCase();
}

// Find, format, and save three most positive/negative sentences
function saveTopSentences() {
    if (updated) {
        // Sort the predictions
        let scores_sorted = sentence_scores.slice(0).sort();
        
        let top_max_scores;
        let top_min_scores;

        // Extract the (max) 3 most positive/negative sentence scores
        top_max_scores = scores_sorted.slice(-(Math.min(scores_sorted.length,3)+1),-1).reverse();
        top_min_scores = scores_sorted.slice(0,Math.min(scores_sorted.length,3));

        let text = '';
        let sent = 0;
        let idx = 0;

        // Find sentences corresponding to the top positive scores and format 
        for (var i = 0; i < top_max_scores.length; i++) {            
            if (top_max_scores[i]>0.5) {
                idx = sentence_scores.indexOf(top_max_scores[i]);
                text = web_content[idx];
                sent = (scoreToInterval(top_max_scores[i])*100).toFixed(2);
                pos_examples[i] = "<strong>" + (i+1) + ")</strong> " + text + '<br>(<i>' + sent + '\% positive</i>)';
                // avoid .indexOf() returning the same index for identical scores
                sentence_scores.splice(idx, 1);
                web_content.splice(idx, 1);
            }
        }

        // Find sentences corresponding to the top negative scores and format 
        for (var i = 0; i < top_min_scores.length; i++) {            
            if (top_min_scores[i]<0.5) {
                idx = sentence_scores.indexOf(top_min_scores[i]);
                text = web_content[idx];
                sent = (Math.abs(scoreToInterval(top_min_scores[i]))*100).toFixed(2);
                neg_examples[i] = "<strong>" + (i+1) + ")</strong> " + text + '<br>(<i>' + sent + '\% negative</i>)';
                // avoid .indexOf() returning the same index for identical scores
                sentence_scores.splice(idx, 1);
                web_content.splice(idx, 1);
            }
        }
    }
}

// Compute the average sentiment score of all sentences and call/update front-end
async function computeScores(web_content) {
    var sumOfScores = 0;
    var countScores = 0;
    await loadModel();
    for (sentence of web_content) {
        await predict(sentence).then((score) => {
            sentence_scores.push(score.toFixed(10));
            sumOfScores += score;
            countScores++;
        });
    }
    var mean_score = (sumOfScores / countScores).toFixed(4);
    let sentiment = scoreToInterval(mean_score);
    // Update front-end
    updatePopUp(sentiment);
    updated = true;
    // Save top positiven/negative sentences to global variables
    saveTopSentences();
}

// Exctract and format all relevant text contained in body of the active page and call computeScores()
async function getSentiment() {
    // Minimum number of characters in each sentence
    let min_sentence = 30;

    // Decide which part of the DOM we are interested (text in the body segment of the HTML code)
    function getDOM() {
        return document.body.innerText;
    }    
   try {
        chrome.tabs.executeScript({
            code: '(' + getDOM + ')();' 
        }, (results) => {
            let text = results[0];
            // Split the raw text data into sentences
            let raw_content = text.replace(/((\.)\s)|(\.$)/g, ".\n")
            .replace(/\!+\)|\?+\)/g, ")")
            .replace(/((\?)\s)|(\?)/g, "?\n")
            .replace(/((\!)\s)|(\!)/g, "!\n")
            .split("\n",5000);
            // remove very short or empty sentences
            let j = 0;
            web_content = [] // reset in case called twice
            for (var i = 0; i < raw_content.length; i++) {
                if (raw_content[i].length >= min_sentence && !raw_content[i].includes('©') && !isUpperCase(raw_content[i])) {
                    web_content.push(raw_content[i]);
                    // debug segment
                    console.log(j, raw_content[i].length, raw_content[i]);
                    j++;
                }   
            }
            // Compute sentiment scores for the cleaned text/sentences
            if (web_content) {
                computeScores(web_content);
            }
        });
    } catch (err) {
        // If the attempt to obtain all relevant text data fails, let the user know
        document.getElementById('textID').innerHTML = 'Something went wrong...';
        document.getElementById('iconID').src = '../icons/oops.png';
    }
}