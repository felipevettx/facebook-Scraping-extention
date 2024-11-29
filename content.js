console.log("Content script cargado");

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Mensaje recibido en content script:", message);
  if (message.action === "scrape") {
    scrapeMarketplace();
  }
});

function waitForElement(selectors, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    function checkElement() {
      for (let selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          console.log(`Elemento encontrado: ${selector}`);
          resolve(elements);
          return;
        }
      }
      
      if (Date.now() - startTime > timeout) {
        console.log(`Tiempo de espera agotado. Selectores probados: ${selectors.join(', ')}`);
        reject(new Error(`Elementos ${selectors.join(', ')} no encontrados después de ${timeout}ms`));
      } else {
        setTimeout(checkElement, 500);
      }
    }
    
    checkElement();
  });
}

function extractProductData(productElement) {
  console.log("Extrayendo datos de producto:", productElement);
  const productId = productElement.href.split("/item/")[1]?.split("/")[0] || "Id don't aviable"
  const titleElement = productElement.querySelector('span[dir="auto"]') || productElement.querySelector('span');
  const priceElement = productElement.querySelector('span[aria-label]') || productElement.querySelector('span:nth-child(2)');
  const locationElement = productElement.querySelector('span[aria-label] + span') || productElement.querySelector('span:nth-child(3)');
  const imageElement = productElement.querySelector('img');
const descriptionElement = productElement.querySelector('span[dir="auto"]:not(:first-child)')
  return {
    id: productId,
    title: titleElement ? titleElement.textContent.trim() : 'Título no disponible',
    price: priceElement ? priceElement.textContent.trim() : 'Precio no disponible',
    location: locationElement ? locationElement.textContent.trim() : 'Ubicación no disponible',
    imageUrl: imageElement ? imageElement.src : '',
    link: productElement.href
  };
}

function scrollPage() {
  return new Promise((resolve) => {
    let totalHeight = 0;
    let distance = 300;
    let timer = setInterval(() => {
      let scrollHeight = document.documentElement.scrollHeight;
      window.scrollBy(0, distance);
      totalHeight += distance;

      if(totalHeight >= scrollHeight){
        clearInterval(timer);
        resolve();
      }
    }, 200);
  });
}

async function scrapeMarketplace() {
  console.log("Iniciando extracción de datos del Marketplace...");

  try {
    await scrollPage();
    console.log("Página desplazada completamente");

    const productElements = await waitForElement([
      'div[aria-label="Colección de artículos en venta en Marketplace"] a[href^="/marketplace/item/"]',
      'div[data-pagelet="BrowseFeedUpsell"] a[href^="/marketplace/item/"]',
      'div[data-pagelet="MainFeed"] a[href^="/marketplace/item/"]',
      'a[href^="/marketplace/item/"]'
    ]);

    console.log(`Encontrados ${productElements.length} elementos de producto`);

    if (productElements.length === 0) {
      throw new Error("No se encontraron productos en la página");
    }

    const products = Array.from(productElements).map(extractProductData);

    console.log(`Se extrajeron datos de ${products.length} productos`);
    console.log("Muestra de datos extraídos:", products[0]);
    // Enviar los datos al background script
    browser.runtime.sendMessage({ action: "scrapeComplete", payload: products });
  } catch (error) {
    console.error("Error durante la extracción:", error);
    browser.runtime.sendMessage({ action: "scrapeError", error: error.message });
  }
}

// Ejecución aoutomatica del scrapeMarketplace cuando se carga la página
window.addEventListener('load', () => {
  console.log("Página cargada, iniciando extracción automática");
  setTimeout(scrapeMarketplace, 5000); // Espera 5 segundos para iniciar la extracción
});

