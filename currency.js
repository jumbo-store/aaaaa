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

const CURRENCY_CACHE_KEY = "currencyRatesECB";
const CURRENCY_CACHE_TIME_KEY = "currencyRatesECBTime";
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
    const rate = currencyRates[selectedCurrency] || 1;
    const amount = Number(amountEUR) * rate;
    const formatted = amount.toLocaleString(undefined, {
        minimumFractionDigits: currency.decimals,
        maximumFractionDigits: currency.decimals
    });
    return currency.symbol + formatted;
}

function updateCurrencyUI() {
    const currentCurrency = document.getElementById("currentCurrency");
    if (currentCurrency) currentCurrency.textContent = selectedCurrency;

    document.querySelectorAll("[data-product-price]").forEach(function(element) {
        const id = Number(element.dataset.productPrice);
        const item = typeof products !== "undefined"
            ? products.find(function(product) { return product.id === id; })
            : null;
        const firstTier = item && item.prices && item.prices[0];
        if (firstTier) element.textContent = formatCurrency(firstTier.priceEUR);
    });

    document.dispatchEvent(new CustomEvent("currencyChanged"));
}

function setCurrency(currency) {
    if (!supportedCurrencies[currency]) return;
    selectedCurrency = currency;
    localStorage.setItem("currency", currency);
    updateCurrencyUI();
    closeCurrencyMenu();
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

async function loadCurrencyRates() {
    const cachedTime = Number(localStorage.getItem(CURRENCY_CACHE_TIME_KEY) || 0);
    const cached = localStorage.getItem(CURRENCY_CACHE_KEY);

    if (cached && Date.now() - cachedTime < CURRENCY_CACHE_TTL) {
        try {
            currencyRates = JSON.parse(cached);
            updateCurrencyUI();
            return;
        } catch (error) {}
    }

    try {
        const quotes = Object.keys(supportedCurrencies).filter(function(code) {
            return code !== "EUR";
        }).join(",");

        const response = await fetch(
            "https://api.frankfurter.dev/v2/rates?base=EUR&quotes=" + quotes + "&providers=ECB",
            { cache: "no-store" }
        );

        if (!response.ok) throw new Error("Currency request failed");

        const data = await response.json();
        const nextRates = { EUR: 1 };

        data.forEach(function(row) {
            if (row && row.quote && typeof row.rate === "number") {
                nextRates[row.quote] = row.rate;
            }
        });

        currencyRates = nextRates;
        localStorage.setItem(CURRENCY_CACHE_KEY, JSON.stringify(currencyRates));
        localStorage.setItem(CURRENCY_CACHE_TIME_KEY, String(Date.now()));
        updateCurrencyUI();
    } catch (error) {
        /* EUR still works when the network is unavailable. */
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

window.getCurrency = getCurrency;
window.formatCurrency = formatCurrency;
window.setCurrency = setCurrency;

updateCurrencyUI();
loadCurrencyRates();