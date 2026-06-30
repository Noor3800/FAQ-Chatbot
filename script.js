// --- Stopword list, used during preprocessing ---
var STOPWORDS = ["a","an","the","is","are","was","were","be","been","being","do","does","did",
  "of","in","on","at","to","for","with","and","or","but","if","so","i","you","my","your",
  "it","its","this","that","what","how","can","could","would","will","shall","should",
  "as","by","from","about","into","than","then","there"];

// --- Seed FAQ data (collected questions + answers) ---
var faqs = [
  { q: "How do I reset my password?", a: "Go to Settings > Security > Reset password, then follow the link sent to your registered email." },
  { q: "What payment methods do you accept?", a: "We accept all major credit cards, PayPal, and bank transfers for annual plans." },
  { q: "How can I cancel my subscription?", a: "Open Billing in your account settings and choose Cancel plan. It stays active until the end of the billing cycle." },
  { q: "Do you offer a free trial?", a: "Yes, every new account gets a 14 day free trial with full access to all features." },
  { q: "How do I contact customer support?", a: "Email support@example.com or use the chat bubble in the bottom right corner of the dashboard." },
  { q: "Is my data secure?", a: "All data is encrypted in transit and at rest, and we run regular third-party security audits." }
];

// --- Preprocessing: lowercase, strip punctuation, tokenize, remove stopwords ---
function tokenize(text){
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(function(t){ return t.length > 0 && STOPWORDS.indexOf(t) === -1; });
}

function buildVocab(docsTokens){
  var vocabSet = {};
  docsTokens.forEach(function(tokens){
    tokens.forEach(function(t){ vocabSet[t] = true; });
  });
  return Object.keys(vocabSet);
}

function termFreq(tokens){
  var tf = {};
  tokens.forEach(function(t){ tf[t] = (tf[t] || 0) + 1; });
  var total = tokens.length || 1;
  Object.keys(tf).forEach(function(k){ tf[k] = tf[k] / total; });
  return tf;
}

function inverseDocFreq(vocab, docsTokens){
  var idf = {};
  var N = docsTokens.length;
  vocab.forEach(function(term){
    var containing = docsTokens.filter(function(tokens){ return tokens.indexOf(term) !== -1; }).length;
    idf[term] = Math.log((N + 1) / (containing + 1)) + 1;
  });
  return idf;
}

function toVector(tf, idf, vocab){
  return vocab.map(function(term){
    return (tf[term] || 0) * (idf[term] || 0);
  });
}

function cosineSim(a, b){
  var dot = 0, normA = 0, normB = 0;
  for(var i = 0; i < a.length; i++){
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if(normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// --- Matching: build TF-IDF vectors for all FAQs + the query, score by cosine similarity ---
function findBestMatch(query){
  if(faqs.length === 0) return null;
  var docsTokens = faqs.map(function(f){ return tokenize(f.q); });
  var queryTokens = tokenize(query);
  var vocab = buildVocab(docsTokens.concat([queryTokens]));
  var idf = inverseDocFreq(vocab, docsTokens);

  var faqVectors = docsTokens.map(function(tokens){
    return toVector(termFreq(tokens), idf, vocab);
  });
  var queryVector = toVector(termFreq(queryTokens), idf, vocab);

  var best = { index: -1, score: 0 };
  faqVectors.forEach(function(vec, i){
    var score = cosineSim(queryVector, vec);
    if(score > best.score){
      best = { index: i, score: score };
    }
  });
  return best;
}

// --- UI wiring ---
var kbList = document.getElementById("kbList");
var faqCount = document.getElementById("faqCount");
var chatLog = document.getElementById("chatLog");
var chatInput = document.getElementById("chatInput");

function renderKB(){
  kbList.innerHTML = "";
  faqs.forEach(function(f, i){
    var item = document.createElement("div");
    item.className = "kb-item";
    var q = document.createElement("p"); q.className = "q"; q.textContent = f.q;
    var a = document.createElement("p"); a.className = "a"; a.textContent = f.a;
    var rm = document.createElement("button"); rm.className = "rm"; rm.textContent = "✕"; rm.title = "Remove";
    rm.addEventListener("click", function(){
      faqs.splice(i, 1);
      renderKB();
    });
    item.appendChild(rm);
    item.appendChild(q);
    item.appendChild(a);
    kbList.appendChild(item);
  });
  faqCount.textContent = faqs.length;
}

function addMessage(text, who, meta){
  var msg = document.createElement("div");
  msg.className = "msg " + who;
  var bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  msg.appendChild(bubble);
  if(meta){
    var m = document.createElement("div");
    m.className = "meta";
    m.textContent = meta;
    msg.appendChild(m);
  }
  chatLog.appendChild(msg);
  chatLog.scrollTop = chatLog.scrollHeight;
}

// Confidence floor: matches below this similarity score are treated as "no match"
var CONFIDENCE_THRESHOLD = 0.12;

function handleSend(){
  var text = chatInput.value.trim();
  if(!text) return;
  addMessage(text, "user");
  chatInput.value = "";

  var result = findBestMatch(text);
  if(!result || result.index === -1 || result.score < CONFIDENCE_THRESHOLD){
    addMessage("I don't have a matching answer for that yet. Try rephrasing, or add it to the card file.", "bot", "no confident match");
    return;
  }
  var match = faqs[result.index];
  addMessage(match.a, "bot", "matched \"" + match.q + "\" · similarity " + result.score.toFixed(2));
}

document.getElementById("sendBtn").addEventListener("click", handleSend);
chatInput.addEventListener("keydown", function(e){
  if(e.key === "Enter") handleSend();
});

document.getElementById("addFaqBtn").addEventListener("click", function(){
  var q = document.getElementById("newQ").value.trim();
  var a = document.getElementById("newA").value.trim();
  if(!q || !a) return;
  faqs.push({ q: q, a: a });
  document.getElementById("newQ").value = "";
  document.getElementById("newA").value = "";
  renderKB();
});

renderKB();
addMessage("Ask me anything from the card file on the left — I'll match it to the closest question.", "bot");