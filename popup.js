function createBlock(label, value, isSelected = false) {
  const container = document.createElement("div");
  container.className = "xpath-block";
  container.style.position = "relative";

  const title = document.createElement("strong");
  title.textContent = label;

  const inputWrapper = document.createElement("div");
  inputWrapper.className = "xpath-input-wrapper";

  const input = document.createElement("textarea");
  input.readOnly = true;
  input.value = value;
  input.rows = 1;
  input.className = "xpath-textarea";

  inputWrapper.appendChild(input);

  const button = document.createElement("button");
  button.textContent = "Copy XPath";
  button.title = "Copy";
  button.className = "copy-btn";

  const statusSpan = document.createElement("span");
  statusSpan.className = "copy-status";
  statusSpan.style.marginLeft = "8px";

  button.onclick = () => {
    navigator.clipboard.writeText(input.value).then(() => {
      statusSpan.textContent = "Copied!";
      setTimeout(() => statusSpan.textContent = "", 1500);
    });
  };

  const radio = document.createElement("input");
  radio.type = "radio";
  radio.name = "selectedXpath";
  radio.value = value;
  radio.checked = isSelected;
  radio.className = "xpath-radio-bottom";

  container.appendChild(title);
  container.appendChild(inputWrapper);
  container.appendChild(button);
  container.appendChild(statusSpan);
  container.appendChild(radio);

  return container;
}

function loadXpaths() {
  chrome.storage.local.get(null, (result) => {
    const container = document.getElementById("xpaths");
    container.innerHTML = "";

    const toggle = result.xpathMode ?? false;
    document.getElementById("toggleMode").checked = toggle;
    document.getElementById("modeLabel").textContent = toggle ? "ON" : "OFF";

    const otherXpaths = result.otherXpaths || {};
    const mainXpaths = Object.entries(result).filter(([k]) => !["xpathMode", "otherXpaths", "codeHistory", "theme"].includes(k));

    if (mainXpaths.length === 0) {
      container.textContent = "No element selected yet.";
      return;
    }

    mainXpaths.forEach(([label, xpath], index) => {
      container.appendChild(createBlock(label, xpath, index === 0));
    });

    if (Object.keys(otherXpaths).length > 0) {
      const otherBox = document.createElement("details");
      otherBox.classList.add("other-xpath");
      otherBox.innerHTML = `<summary>Other XPath Options</summary>`;
      Object.entries(otherXpaths).forEach(([label, xpath]) => {
        otherBox.appendChild(createBlock(label, xpath));
      });
      container.appendChild(otherBox);
    }
  });
}

function loadHistory() {
  chrome.storage.local.get("codeHistory", ({ codeHistory }) => {
    const container = document.getElementById("historySection");
    container.innerHTML = "";

    if (!codeHistory || codeHistory.length === 0) {
      container.textContent = "History is empty.";
      return;
    }

    codeHistory.slice().reverse().forEach((item, index) => {
      const div = document.createElement("div");
      div.className = "history-block";
      div.innerHTML = `<strong>${item.timestamp}</strong><pre>${item.code}</pre>`;

      const btn = document.createElement("button");
      btn.textContent = "📋 Copy Code";
      btn.className = "copy-btn";

      const span = document.createElement("span");
      span.className = "copy-status";
      span.style.marginLeft = "8px";

      btn.onclick = () => {
        navigator.clipboard.writeText(item.code).then(() => {
          span.textContent = "Copied!";
          setTimeout(() => span.textContent = "", 1500);
        });
      };

      div.appendChild(btn);
      div.appendChild(span);
      container.appendChild(div);
    });
  });
}

function toggleTheme(enabled) {
  document.body.classList.toggle("dark-mode", enabled);
  chrome.storage.local.set({ theme: enabled });
  document.getElementById("themeToggle").textContent = enabled ? "☀️" : "🌙";
}

document.addEventListener("DOMContentLoaded", () => {
  loadXpaths();
  loadHistory();

  document.getElementById("waitWrapper").style.display = "none";
  document.getElementById("sleepWrapper").style.display = "block";

  document.getElementById("action").addEventListener("change", function () {
    const selectedAction = this.value;
    const showWait = selectedAction === "click" || selectedAction === "sendKeys";

    document.getElementById("textInputWrapper").style.display = selectedAction === "sendKeys" ? "block" : "none";
    document.getElementById("waitWrapper").style.display = showWait ? "block" : "none";
  });

  document.getElementById("action").dispatchEvent(new Event("change"));

  chrome.storage.local.get("theme", ({ theme }) => {
    toggleTheme(theme);
  });
});

document.getElementById("toggleMode").addEventListener("change", function () {
  const enabled = this.checked;
  chrome.storage.local.set({ xpathMode: enabled }, () => {
    document.getElementById("modeLabel").textContent = enabled ? "ON" : "OFF";
    loadXpaths();
  });
});

document.getElementById("themeToggle").addEventListener("click", () => {
  const isDark = document.body.classList.contains("dark-mode");
  toggleTheme(!isDark);
});

document.getElementById("generateCodeBtn").addEventListener("click", () => {
  const selectedRadio = document.querySelector('input[name="selectedXpath"]:checked');
  if (!selectedRadio) {
    document.getElementById("codeOutput").textContent = "Please select an XPath.";
    return;
  }

  const xpath = selectedRadio.value;
  const language = document.getElementById("language").value;
  const action = document.getElementById("action").value;
  const inputText = document.getElementById("sendKeysText").value || "your_text";
  const variableNameInput = document.getElementById("variableName").value.trim();
  const useWait = document.getElementById("useWait").checked;
  const waitTime = parseInt(document.getElementById("waitTime").value) || 10;
  const useSleep = document.getElementById("useSleep").checked;
  const sleepTime = parseInt(document.getElementById("sleepTime").value) || 3;

  let variableName = variableNameInput;
  if (!variableName) {
    if (action === "click" || action === "sendKeys") variableName = "element";
    else if (action === "getText") variableName = "textElement";
    else if (action === "isDisplayed") variableName = "visibilityElement";
  }

  let code = "", importCode = "";

  if (language === "python") {
    if (useWait && (action === "click" || action === "sendKeys")) {
      importCode = `from selenium.webdriver.support.ui import WebDriverWait\nfrom selenium.webdriver.support import expected_conditions as EC\n`;
    }
    if (useSleep) {
      importCode += `import time\n`;
      code += `time.sleep(${sleepTime})\n`;
    }

    if (action === "click") {
      code += useWait
        ? `${variableName} = WebDriverWait(driver, ${waitTime}).until(EC.element_to_be_clickable((By.XPATH, "${xpath}")))\n${variableName}.click()`
        : `${variableName} = driver.find_element(By.XPATH, "${xpath}")\n${variableName}.click()`;
    } else if (action === "sendKeys") {
      code += useWait
        ? `${variableName} = WebDriverWait(driver, ${waitTime}).until(EC.element_to_be_clickable((By.XPATH, "${xpath}")))\n${variableName}.send_keys("${inputText}")`
        : `${variableName} = driver.find_element(By.XPATH, "${xpath}")\n${variableName}.send_keys("${inputText}")`;
    } else if (action === "getText") {
      code += `${variableName} = driver.find_element(By.XPATH, "${xpath}")\n${variableName}_text = ${variableName}.text`;
    } else if (action === "isDisplayed") {
      code += `${variableName} = driver.find_element(By.XPATH, "${xpath}")\n${variableName}_visible = ${variableName}.is_displayed()`;
    }
  } else if (language === "java") {
    if (useWait && (action === "click" || action === "sendKeys")) {
      importCode = `import org.openqa.selenium.support.ui.WebDriverWait;\nimport org.openqa.selenium.support.ui.ExpectedConditions;\nimport java.time.Duration;`;
    }

    if (action === "click") {
      code += useWait
        ? `WebElement ${variableName} = new WebDriverWait(driver, Duration.ofSeconds(${waitTime})).until(ExpectedConditions.elementToBeClickable(By.xpath("${xpath}")));\n${variableName}.click();`
        : `WebElement ${variableName} = driver.findElement(By.xpath("${xpath}"));\n${variableName}.click();`;
    } else if (action === "sendKeys") {
      code += useWait
        ? `WebElement ${variableName} = new WebDriverWait(driver, Duration.ofSeconds(${waitTime})).until(ExpectedConditions.elementToBeClickable(By.xpath("${xpath}")));\n${variableName}.sendKeys("${inputText}");`
        : `WebElement ${variableName} = driver.findElement(By.xpath("${xpath}"));\n${variableName}.sendKeys("${inputText}");`;
    } else if (action === "getText") {
      code += `WebElement ${variableName} = driver.findElement(By.xpath("${xpath}"));\nString ${variableName}Text = ${variableName}.getText();`;
    } else if (action === "isDisplayed") {
      code += `WebElement ${variableName} = driver.findElement(By.xpath("${xpath}"));\nboolean ${variableName}Visible = ${variableName}.isDisplayed();`;
    }

    if (useSleep) {
      code = `try {\n  Thread.sleep(${sleepTime * 1000});\n} catch (InterruptedException e) {\n  e.printStackTrace();\n}\n` + code;
    }
  }

  document.getElementById("codeOutput").textContent = code;
  document.getElementById("importOutput").textContent = importCode;
  document.getElementById("importSection").style.display = (useWait || useSleep) ? "block" : "none";

  const timestamp = new Date().toLocaleString();
  chrome.storage.local.get("codeHistory", ({ codeHistory = [] }) => {
    codeHistory.push({ code, timestamp });
    if (codeHistory.length > 10) codeHistory = codeHistory.slice(-10);
    chrome.storage.local.set({ codeHistory }, loadHistory);
  });
});

document.getElementById("copyCodeBtn").addEventListener("click", () => {
  const code = document.getElementById("codeOutput").textContent.trim();
  if (code) {
    navigator.clipboard.writeText(code).then(() => {
      const status = document.getElementById("copyStatus");
      status.className = "copy-status";
      status.textContent = "Copied!";
      setTimeout(() => status.textContent = "", 1500);
    });
  }
});

document.getElementById("copyImportBtn").addEventListener("click", () => {
  const code = document.getElementById("importOutput").textContent.trim();
  if (code) {
    navigator.clipboard.writeText(code).then(() => {
      const btn = document.getElementById("copyImportBtn");
      if (!btn.nextSibling || !btn.nextSibling.classList || !btn.nextSibling.classList.contains("copy-status")) {
        const span = document.createElement("span");
        span.className = "copy-status";
        span.style.marginLeft = "8px";
        btn.insertAdjacentElement("afterend", span);
      }
      btn.nextSibling.textContent = "Copied!";
      setTimeout(() => btn.nextSibling.textContent = "", 1500);
    });
  }
});
