const locale = "de-DE";
const numberRxp = /(?<=€),?[0-9]/;
const dateSuffixRegex = /([0-9]{1,2})[a-z]{2}/;
const smallDateRegex = /^[0-9]?[0-9] \S*$/;
const mediumDateRegex = /^\S* \d{1,2}[a-z]{0,2}?, \d{4}$/;
const dateWithLongDayRegex = /^\S* \S{3} \d{1,2}[a-z]{0,2}?, \d{4}$/;
const smallDateOptions = {
  day: "2-digit",
  month: "long",
};
const medDateOptions = {
  day: "2-digit",
  month: "long",
  year: "numeric",
};
const bigDateOptions = {
  day: "2-digit",
  month: "long",
  year: "numeric",
  weekday: "long",
};

// initial code entry point if code is injected by the e-commerce-manager
document.addEventListener("DOMContentLoaded", function () {
  start();
});

/**
 * will start everything
 */
function start() {
  // insert mutation observer
  createDocumentObserver();
  // initial modification
  modifyTranslationMistakes(document);
}

function createDocumentObserver() {
  const nodeToObserve = document.body;
  const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      if (mutation?.target?.innerText != "") {
        modifyTranslationMistakes(mutation.target);
      }
      fixBodyUsability(mutation);
    }
  });

  observer.observe(nodeToObserve, {
    childList: true,
    attributes: true,
    subtree: true,
  });
}

function modifyTranslationMistakes(node) {
  transformTextElements(node);
  transformNumberElements(node);
}

function fixBodyUsability(mutatedElement) {
  if (
    mutatedElement?.target?.tagName == "BODY" &&
    mutatedElement.attributeName == "style"
  ) {
    mutatedElement.target.style.removeProperty("pointer-events");
  }
}

const nodeDataToLocaleDateResolver = (node, dateString, options) => {
  let d = new Date(dateString);
  node.data = d.toLocaleDateString(locale, options);
};

/**
 * processors to match node data for formatting dates if found
 */
function processSmallDatesFromNode(node) {
  let trimmedNodeText = node.textContent.trim();
  if (
    smallDateRegex.test(trimmedNodeText) &&
    !trimmedNodeText.includes("Wochen")
  ) {
    node.customResolver = (
      node,
      dateString = `${trimmedNodeText} ${new Date().getFullYear()}`,
      options = smallDateOptions
    ) => nodeDataToLocaleDateResolver(node, dateString, options);
    return true;
  }
  return false;
}

function processMediumDatesFromNode(node) {
  let trimmedNodeText = node.textContent.trim();
  if (mediumDateRegex.test(trimmedNodeText)) {
    node.customResolver = (
      node,
      dateString = removeOrdinalNumberFromDate(trimmedNodeText),
      options = medDateOptions
    ) => nodeDataToLocaleDateResolver(node, dateString, options);
    return true;
  }
  return false;
}

function processLargeDatesFromNode(node) {
  let trimmedNodeText = node.textContent.trim();
  if (dateWithLongDayRegex.test(trimmedNodeText)) {
    node.customResolver = (
      node,
      dateString = trimmedNodeText,
      options = bigDateOptions
    ) => nodeDataToLocaleDateResolver(node, dateString, options);
    return true;
  }
  return false;
}

function processTextFromNode(node) {
  let foundSubstringsToReplace = translationKeys.filter((key) =>
    node.textContent.includes(key)
  );
  if (foundSubstringsToReplace.length) {
    node.customResolver = (node, substrings = foundSubstringsToReplace) => {
      for (const substring of substrings) {
        node.data = node.data.replaceAll(
          substring,
          additionalTranslations[substring]
        );
      }
    };
    return true;
  }
  return false;
}

/**
 * transformer functions
 * every function point changes one type of string in the doc
 * e.g. texts with dates or numbers
 */
function transformTextElements(rootNode) {
  const treeWalker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT, {
    acceptNode: function (node) {
      if (processSmallDatesFromNode(node)) {
        return NodeFilter.FILTER_ACCEPT;
      }

      if (processMediumDatesFromNode(node)) {
        return NodeFilter.FILTER_ACCEPT;
      }

      if (processLargeDatesFromNode(node)) {
        return NodeFilter.FILTER_ACCEPT;
      }

      if (processTextFromNode(node)) {
        return NodeFilter.FILTER_ACCEPT;
      }

      return NodeFilter.FILTER_REJECT;
    },
  });

  let treeWalkerNode = null;
  while ((treeWalkerNode = treeWalker.nextNode())) {
    if (treeWalkerNode.customResolver) {
      treeWalkerNode.customResolver(treeWalkerNode);
    }
  }
}

function transformNumberElements(rootNode) {
  // find and go trough iterations
  let res = document.evaluate(
    `//*[contains(text(), "€")]`,
    rootNode,
    null,
    XPathResult.ANY_TYPE,
    null
  );
  if (res) {
    let xpathNode = null;
    const nodes = [];
    // cannot modify in here because iteration will break
    while ((xpathNode = res.iterateNext())) {
      nodes.push(xpathNode);
    }
    for (const n of nodes) {
      let elementInnerText = n.innerText;
      // test if its fit or recursion will kill all
      if (numberRxp.test(elementInnerText)) {
        elementInnerText = elementInnerText.replaceAll("€", "");
        n.innerText = `${formatNumber(elementInnerText)} €`;
      }
    }
  }
}

/**
 * helper
 */
function formatNumber(numString) {
  let number = Number(numString);
  return number ? number.toLocaleString(locale) : numString;
}

function removeOrdinalNumberFromDate(dateString) {
  let match = dateString.match(dateSuffixRegex);
  return match?.length == 2
    ? dateString.replaceAll(match[0], match[1])
    : dateString;
}

/**
 * translation table, add new found english translation errors as keys and the correct translation as value
 * because we need only german, we have only one
 */
const additionalTranslations = {
  // profile
  City: "Stadt",
  Country: "Land",
  Germany: "Deutschland",
  "Postal Code": "Plz",
  "Street Address": "Straße",

  // menu
  "Subscription Manager": "Abonement Verwaltung",

  // other controls
  "New Subscription": "Neues Abonnement",

  // subscriptions
  Paused: "Pausiert",

  // sub cards (no subway)
  "Paused Subscriptions": "Pausierte Abonnements",
  "Next delivery": "Nächste Lieferung",
  weeks: "Wochen",
  Selected: "Ausgewählte",
  Active: "Aktiv",
  until: "bis",
  "flavors for": "Geschmacksrichtungen für",
  Skipped: "Übersprungen",
  "Billed every": "Rechnung alle",
  flavors: "Geschmacksrichtungen",
  Subscriptions: "Abonnements",
  Subscription: "Abonnement",
  "Started on": "Gestartet am: ",
  "Delivery Address": "Lieferadresse",
  "Update your delivery address for subscriptions":
    "Update pls. sonst kommen die Pakete beim Nachbar an!",
  "You have selected": "Deine Auswahl",
  " of ": " von ",
  "wöchige Subscription": "wöchiges Abonnement",

  // toast
  "skipped for": "übersprungen für",
  resumed: "fortgesetzt",
  "Subscription paused": "Abonnement pausiert",

  // next delivery dialog
  "deine Subscription": "deine Abonnements",

  // pause dialog
  Cancel: "Immer weiter",
  "Pause until": "Pause bis",
  "Select a date until when you want to pause your subscription.":
    "Wähle ein Datum bis wann du dein Abonnemnt pausieren möchtest",
  "Pause Subscription": "Abonnement pausieren ;(",
  "Pause subscription": "Abonnement pausieren ;(",
};

/**
 * get all keys to prevent calling Object.keys all time when searching
 * keys need to be sorted from biggest to smallest one to reduce errors on replacing
 */
const translationKeys = Object.keys(additionalTranslations).sort(
  (keyA, keyB) => keyB.length - keyA.length
);
