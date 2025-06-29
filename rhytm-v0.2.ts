// Импорт необходимых пакетов
import * as ccxt from 'ccxt'
import * as dotenv from 'dotenv'

// Загрузка переменных окружения из .env
dotenv.config()

// Функция для форматирования времени
function getTimestamp(): string {
    return new Date().toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}
// Переопределяем console.log для добавления временной метки
const originalConsoleLog = console.log;
console.log = (...args: any[]) => {
    originalConsoleLog(`[${getTimestamp()}]`, ...args);
};
// Переопределяем console.error для добавления временной метки
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
    originalConsoleError(`[${getTimestamp()}]`, ...args);
};

// Иниицализация биржи
const exchange = new ccxt.mexc({
    apiKey: process.env.MEXC_API_KEY,
    secret: process.env.MEXC_API_SECRET,
    enableRateLimit: true,
})

// Функция для получения данных о торговой паре
async function getMarketPrecision(): Promise<{ amountPrecision: number, minAmount: number }> {
    await exchange.loadMarkets()
    const market = exchange.market(SYMBOL)
    const amountPrecision = market.precision.amount || 8;
    const minAmount = market.limits.amount?.min || 0.0001;
    // console.log(`amountPrecision = ${amountPrecision} | minAmount = ${minAmount}`)
    return { amountPrecision, minAmount };
}
// Загружаем один раз в нужные переменные
const SYMBOL: string = 'ALPH/USDT' // Символ на бирже
const POLLING_INTERVAL = 5000;
let totalProfit: number = 0

// Торговые стратегии
const TRADING_STRATEGIES = [
    { buyPrice: 0.3182, sellPrice: 0.3192, tradeAmountUsdt: 10 },
    { buyPrice: 0.3187, sellPrice: 0.3197, tradeAmountUsdt: 10 },
    { buyPrice: 0.3192, sellPrice: 0.3202, tradeAmountUsdt: 10 },
    { buyPrice: 0.3197, sellPrice: 0.3207, tradeAmountUsdt: 10 },
    { buyPrice: 0.3202, sellPrice: 0.3212, tradeAmountUsdt: 10 },
    { buyPrice: 0.3207, sellPrice: 0.3217, tradeAmountUsdt: 10 },
    { buyPrice: 0.3212, sellPrice: 0.3222, tradeAmountUsdt: 10 },
    { buyPrice: 0.3217, sellPrice: 0.3227, tradeAmountUsdt: 10 },
    { buyPrice: 0.3222, sellPrice: 0.3232, tradeAmountUsdt: 10 },
    { buyPrice: 0.3227, sellPrice: 0.3237, tradeAmountUsdt: 10 },
    { buyPrice: 0.3232, sellPrice: 0.3242, tradeAmountUsdt: 10 },
    { buyPrice: 0.3237, sellPrice: 0.3247, tradeAmountUsdt: 10 },
    { buyPrice: 0.3242, sellPrice: 0.3252, tradeAmountUsdt: 10 },
    // { buyPrice: 0.3247, sellPrice: 0.3257, tradeAmountUsdt: 10 },
    // { buyPrice: 0.3252, sellPrice: 0.3262, tradeAmountUsdt: 10 },
    // { buyPrice: 0.3257, sellPrice: 0.3267, tradeAmountUsdt: 10 },
    // { buyPrice: 0.3262, sellPrice: 0.3272, tradeAmountUsdt: 10 },
    // { buyPrice: 0.3267, sellPrice: 0.3277, tradeAmountUsdt: 10 },
    // { buyPrice: 0.3272, sellPrice: 0.3282, tradeAmountUsdt: 10 },
];

// *********** Логика торгов ************* //

// Создание ордера на покупку
async function placeBuyOrder(amount: number, buyPrice: number): Promise<string> {
    while (true) {
        try {
            const order = await exchange.createLimitBuyOrder(SYMBOL, amount, buyPrice)
            console.log(`🟢 Создан BUY по ${buyPrice} в количестве ${amount}!`)
            return order.id
        } catch (error) {
            console.error(`Ошибка при создании BUY по ${buyPrice} в количестве ${amount}. Пробую снова...`)
        }
    }
}

// Проверка статуса ордера
async function checkOrderStatus(orderId: string): Promise<boolean> {
    while (true) {
        try {
            const order = await exchange.fetchOrder(orderId, SYMBOL)
            if (order.status === 'closed' && order.filled > 0) {
                console.log(`✔️ Ордер ${orderId} выполнен, объем: ${order.filled}`)
                return true
            }
        } catch {
            console.error(`Ошибка при проверке статуса ордера. Пробую снова...`)
        }
    }
}

// Создание ордера на продажу
async function placeSellOrder(amount: number, sellPrice: number): Promise<string> {
    while (true) {
        try {
            const order = await exchange.createLimitSellOrder(SYMBOL, amount, sellPrice)
            console.log(`🔴 Создан SELL по ${sellPrice} в количестве ${amount}!`)
            return order.id
        } catch {
            console.error(`Ошибка при создании SELL по ${sellPrice} в количестве ${amount}. Пробую снова...`)
        }
    }
}


// *********** Логика стратегии ************* //

async function runStrategy(strategy: { buyPrice: number, sellPrice: number; tradeAmountUsdt: number }) {
    const { buyPrice, sellPrice, tradeAmountUsdt } = strategy;
    try {
        const { amountPrecision, minAmount } = await getMarketPrecision()
        const amount = Number((tradeAmountUsdt / buyPrice).toFixed(amountPrecision));

        if (amount < minAmount) {
            console.error(`Рассчитанное количество ${amount} меньше минимального ${minAmount} для BUY ${buyPrice}`);
            return;
        }

        console.log(`ℹ️ Запуск стратегии для ${SYMBOL} с покупкой по ${buyPrice} и продажей по ${sellPrice}...`);

        while (true) {
            // Создание ордера на покупку и передача в переменную buyOrderId его Id
            let buyOrderId = await placeBuyOrder(amount, buyPrice)
            // Ожидание исполнения ордера на покупку
            while (!(await checkOrderStatus(buyOrderId))) {
                await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
            }
            // Создание ордера на продажу и передача в переменную sellOrderId его Id
            let sellOrderId = await placeSellOrder(amount, sellPrice)
            // Ожидание исполнения ордера на продажу
            while (!(await checkOrderStatus(sellOrderId))) {
                await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
            }
            let profit: number = (amount * sellPrice) - (amount * buyPrice)
            totalProfit += profit
            // Оповещение об удачном цикле
            console.log(`********************************************************************`)
            console.log(`** 💰 Trade BUY[${buyPrice}] -> SELL [${sellPrice}] successful. Profit: ${profit.toFixed(4)}$.`)
            console.log(`** 🏦 Total profit: ${totalProfit.toFixed(4)}$.`)
            console.log(`********************************************************************`)
        }
    } catch (error) {
        console.error(`Ошибка в стратегии с покупкой по ${buyPrice} и продажей по ${sellPrice}.`)
    }
}

// *********** Логика бота ************* //
async function tradingBot() {
    try {
        // Запускаем все стратегии параллельно
        const strategyPromises = TRADING_STRATEGIES.map(strategy => runStrategy(strategy));
        await Promise.all(strategyPromises);
    } catch (error) {
        console.error('Ошибка при запуске бота.')
    }
}

// Запуск бота
(async () => {
    try {
        await tradingBot();
    } catch (error) {
        console.error('Ошибка при запуске бота:', error);
    }
})();