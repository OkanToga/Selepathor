let xpathModeActive = false;


function highlightElement(el, id, borderColor, fillColor) {
  removeElement(id);

  const rect = el.getBoundingClientRect();
  const highlightBox = document.createElement("div");

  highlightBox.id = id;
  highlightBox.style.position = "fixed";
  highlightBox.style.top = `${rect.top}px`;
  highlightBox.style.left = `${rect.left}px`;
  highlightBox.style.width = `${rect.width}px`;
  highlightBox.style.height = `${rect.height}px`;
  highlightBox.style.border = `2px solid ${borderColor}`;
  highlightBox.style.backgroundColor = fillColor;
  highlightBox.style.zIndex = "999999";
  highlightBox.style.pointerEvents = "none";


  highlightBox.style.maxWidth = "100vw";
  highlightBox.style.maxHeight = "100vh";
  highlightBox.style.overflow = "hidden";
  highlightBox.style.boxSizing = "border-box";
  highlightBox.style.margin = "0";
  highlightBox.style.padding = "0";
  highlightBox.style.transform = "translateZ(0)";

  (document.documentElement || document.body).appendChild(highlightBox);
}

function removeElement(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}



function generateXPathVariants(el) {
  const tag = el.tagName.toLowerCase();
  const variants = [];

  if (el.id) {
    variants.push({ label: "ID based XPath", xpath: `//${tag}[@id='${el.id}']`, score: 5 });
  }

  if (el.title) {
    variants.push({ label: "Attribute based title XPath", xpath: `//${tag}[@title='${el.title}']`, score: 4 });
  }

  if (el.alt) {
    variants.push({ label: "Attribute based alt XPath", xpath: `//${tag}[@alt='${el.alt}']`, score: 4 });
  }

  if (el.className && typeof el.className === "string") {
    variants.push({
      label: "Class based XPath",
      xpath: `//${tag}[contains(@class, '${el.className.split(" ")[0]}')]`,
      score: 3
    });
  }

  if (el.innerText && el.innerText.trim().length > 0 && el.innerText.trim().length < 100) {
    variants.push({
      label: "Text based XPath",
      xpath: `//${tag}[text()='${el.innerText.trim()}']`,
      score: 2
    });
  }

  const parent = el.parentElement;
  if (parent && parent.className) {
    const parentTag = parent.tagName.toLowerCase();
    variants.push({
      label: "Parent class XPath",
      xpath: `//${parentTag}[contains(@class, '${parent.className.split(" ")[0]}')]`,
      score: 2
    });
  }

  return variants;
}



function handleClick(event) {
  if (!xpathModeActive) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  if (event.cancelable) event.returnValue = false;

  const el = event.target;
  highlightElement(el, "xpath-click-box", "#1E90FF", "rgba(30, 144, 255, 0.35)");

  const variants = generateXPathVariants(el);
  const good = {};
  const other = {};

  variants.forEach(v => {
    if (v.score >= 3) {
      good[v.label] = v.xpath;
    } else {
      other[v.label] = v.xpath;
    }
  });

    chrome.storage.local.clear(() => {
    chrome.storage.local.set({ ...good, otherXpaths: other });
  });
}



function handleHover(event) {
  if (!xpathModeActive) return;
  highlightElement(event.target, "xpath-hover-box", "#1E90FF", "rgba(30, 144, 255, 0.15)");
}

function clearHover() {
  removeElement("xpath-hover-box");
}


function updateXPathListeners(enabled) {
  if (enabled && !xpathModeActive) {
    window.addEventListener("click", handleClick, { capture: true, passive: false });
    window.addEventListener("mouseover", handleHover, true);
    window.addEventListener("mouseout", clearHover, true);
    xpathModeActive = true;
    console.log("XPath Mode: ON");
  } else if (!enabled && xpathModeActive) {
    window.removeEventListener("click", handleClick, true);
    window.removeEventListener("mouseover", handleHover, true);
    window.removeEventListener("mouseout", clearHover, true);
    removeElement("xpath-hover-box");
    removeElement("xpath-click-box");
    xpathModeActive = false;
    console.log("XPath Mode: OFF");
  }
}


chrome.storage.local.get(["xpathMode"], (res) => {
  updateXPathListeners(res.xpathMode);
});


chrome.storage.onChanged.addListener((changes) => {
  if (changes.xpathMode) {
    updateXPathListeners(changes.xpathMode.newValue);
  }
});
