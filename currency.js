/* =================================
   VALUTA
   ================================= */

const supportedCurrencies = {
    EUR: { symbol: "€", name: "Euro", decimals: 2 },
    USD: { symbol: "$", name: "US Dollar", decimals: 2 },
    GBP: { symbol: "£", name: "Pound", decimals: 2 },
    CHF: { symbol: "CHF ", name: "Swiss Franc", decimals: 2 },
    JPY: { symbol: "¥", name: "Yen", decimals: 0 },
    CNY: { symbol: "¥", name: "Yuan", decimals: 2 },
    CAD: { symbol: "CA$", name: "Canadian Dollar", decimals: 2 },
    AUD: { symbol: "A$", name: "Australian Dollar", decimals: 2 }
};

const CURRENCY_CACHE_KEY = "currencyRatesECB_v2";
const CURRENCY_CACHE_TIME_KEY = "currencyRatesECBTime_v2";
const CURRENCY_CACHE_TTL = 6 * 60 * 60 * 1000;

let currencyRates = { EUR: 1 };
let selectedCurrency = localStorage.getItem("currency") || "EUR";

if (!supportedCurrencies[selectedCurrency]) {
    selectedCurrency = "EUR";
}

function getCurrency() {
    return selectedCurrency;
}

function formatCurrency(amountEUR) {
    const currency = supportedCurrencies[selectedCurrency] || supportedCurrencies.EUR;
    const rate = Number(currencyRates[selectedCurrency] || 1);
    const amount = Number(amountEUR) * rate;

    return currency.symbol + amount.toLocaleString(undefined, {
        minimumFractionDigits: currency.decimals,
        maximumFractionDigits: currency.decimals
    });
}

function updateCurrencyUI() {
    const currentCurrency = document.getElementById("currentCurrency");
    if (currentCurrency) currentCurrency.textContent = selectedCurrency;

    if (typeof products !== "undefined" && Array.isArray(products)) {
        document.querySelectorAll("[data-product-price]").forEach(function(element) {
            const id = Number(element.dataset.productPrice);
            const item = products.find(function(product) {
                return Number(product.id) === id;
            });
            const tiers = item && Array.isArray(item.prices) ? item.prices : [];
            if (tiers.length) {
                const cheapestTier = tiers.reduce(function(lowest, tier) {
                    const lowestUnitPrice = Number(lowest.priceEUR) / Math.max(1, Number(lowest.quantity));
                    const tierUnitPrice = Number(tier.priceEUR) / Math.max(1, Number(tier.quantity));
                    return tierUnitPrice < lowestUnitPrice ? tier : lowest;
                }, tiers[0]);

                const cheapestUnitPrice =
                    Number(cheapestTier.priceEUR) /
                    Math.max(1, Number(cheapestTier.quantity));

                const language = localStorage.getItem("language") || "nl";
                const languageData = typeof translations !== "undefined"
                    ? (translations[language] || translations.en || {})
                    : {};
                const fromLabel = languageData.fromLabel || "From";

                element.textContent = fromLabel + ": " + formatCurrency(cheapestUnitPrice);
            }
        });
    }

    document.dispatchEvent(new CustomEvent("currencyChanged"));
}

function closeCurrencyMenu() {
    const menu = document.getElementById("currencyMenu");
    const button = document.getElementById("currencyButton");
    if (menu) menu.classList.remove("open");
    if (button) button.classList.remove("open");
    if (button) button.setAttribute("aria-expanded", "false");
}

function openCurrencyMenu() {
    const menu = document.getElementById("currencyMenu");
    const button = document.getElementById("currencyButton");
    if (!menu || !button) return;

    const shouldOpen = !menu.classList.contains("open");
    menu.classList.toggle("open", shouldOpen);
    button.classList.toggle("open", shouldOpen);
    button.setAttribute("aria-expanded", String(shouldOpen));
}

function setCurrency(currency) {
    if (!supportedCurrencies[currency]) return;

    selectedCurrency = currency;
    localStorage.setItem("currency", currency);
    updateCurrencyUI();
    closeCurrencyMenu();
}

async function loadCurrencyRates() {
    const cachedTime = Number(localStorage.getItem(CURRENCY_CACHE_TIME_KEY) || 0);
    const cached = localStorage.getItem(CURRENCY_CACHE_KEY);

    if (cached && Date.now() - cachedTime < CURRENCY_CACHE_TTL) {
        try {
            const parsed = JSON.parse(cached);
            if (parsed && typeof parsed === "object") {
                currencyRates = { EUR: 1, ...parsed };
                updateCurrencyUI();
                return;
            }
        } catch (error) {
            // Ignore invalid cache and fetch again.
        }
    }

    try {
        /* Frankfurter uses ECB reference rates. */
        const response = await fetch(
            "https://api.frankfurter.dev/v2/rates?base=EUR&quotes=USD,GBP,CHF,JPY,CNY,CAD,AUD",
            { cache: "no-store" }
        );

        if (!response.ok) throw new Error("Currency request failed: " + response.status);

        const data = await response.json();
        const nextRates = { EUR: 1 };

        if (Array.isArray(data)) {
            data.forEach(function(row) {
                if (row && row.quote && typeof row.rate === "number") {
                    nextRates[row.quote] = row.rate;
                }
            });
        } else if (data && typeof data === "object") {
            Object.entries(data).forEach(function(entry) {
                const code = entry[0];
                const rate = entry[1];
                if (code !== "EUR" && typeof rate === "number") {
                    nextRates[code] = rate;
                }
            });
        }

        currencyRates = nextRates;
        localStorage.setItem(CURRENCY_CACHE_KEY, JSON.stringify(currencyRates));
        localStorage.setItem(CURRENCY_CACHE_TIME_KEY, String(Date.now()));
        updateCurrencyUI();
    } catch (error) {
        /* Keep the site usable with cached/previous rates. */
        updateCurrencyUI();
    }
}

const currencyButton = document.getElementById("currencyButton");
const currencyMenu = document.getElementById("currencyMenu");

if (currencyButton && currencyMenu) {
    currencyButton.addEventListener("click", function(event) {
        event.preventDefault();
        event.stopPropagation();
        openCurrencyMenu();
    });

    currencyMenu.querySelectorAll("[data-currency]").forEach(function(button) {
        button.addEventListener("click", function(event) {
            event.preventDefault();
            event.stopPropagation();
            setCurrency(button.dataset.currency);
        });
    });

    document.addEventListener("click", function(event) {
        if (!currencyMenu.contains(event.target) && !currencyButton.contains(event.target)) {
            closeCurrencyMenu();
        }
    });

    document.addEventListener("keydown", function(event) {
        if (event.key === "Escape") closeCurrencyMenu();
    });
}

document.addEventListener("languageChanged", function() {
    updateCurrencyUI();
});

window.getCurrency = getCurrency;
window.formatCurrency = formatCurrency;
window.setCurrency = setCurrency;

/* Initial render, then update again when fresh rates arrive. */
updateCurrencyUI();
loadCurrencyRates();