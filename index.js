require('dotenv').config();
const ccxt = require('ccxt');
const axios = require('axios');
const { config } = require('dotenv');
let lastPrice;
let boughtPrice = 0;
let soldPrice = 0;

function run() {

  const config = {
    asset: "BTC",
    base: "BUSD",
    allocation: 1,
    spread: 0.0001,
    tickInterval: 10000
  };
  
  const binanceClient = new ccxt.binance({
    apiKey: process.env.API_KEY,
    secret: process.env.API_SECRET
  });
  
  tick(binanceClient, config)
  setInterval(tick, config.tickInterval, binanceClient, config)
}

async function tick(client, config) {
  const market = `${config.asset}/${config.base}`
  const currentPrice = await marketPrice(market)
  const wallet = await getWallet(client, config)
  report(market, lastPrice, currentPrice, wallet)
  trade(market, wallet, currentPrice, client, config)
  lastPrice = currentPrice
}

function report(market, lastPrice, currentPrice, wallet) {
  console.log('')
  console.log('New Tick\n--------')
  console.log(`Market: ${market}`)
  console.log(`Last Price: ${lastPrice}`)
  console.log(`Current Price: ${currentPrice}`)
  console.log(comparePrices(lastPrice, currentPrice))
  console.log(`\nWallet\nBUSD ${wallet.base}\nBTC ${wallet.asset}`)
}

function trade(market, wallet, price, client, config) {
  if (wallet.base/price > wallet.asset && wallet.base > 15) {
    newBuyOrder(market, wallet.base, price, client, config)
  } else if (wallet.base/price < wallet.asset && price > boughtPrice) {
    newSellOrder(market, wallet.asset, price, client, config)
  }
}

function comparePrices(lastPrice, currentPrice) {
  const direction = lastPrice < currentPrice ? '+' : '-'
  const percentage = Math.abs(lastPrice - currentPrice)/lastPrice*100
  return direction + ' ' + percentage + '%'
}

async function getWallet(client, config) {
  const balances = await client.fetchBalance();
  const wallet = {
    asset: balances.free[config.asset],
    base: balances.free[config.base]
  }
  return wallet
}

async function marketPrice(market) {
  market = market.replace('/', '')
  const results = await Promise.all([
    axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${market}`)
  ]);
  // console.log(results)
  return results[0].data.price
}

async function newBuyOrder(market, balance, price, client, config) {
  const volume = balance/price * config.allocation
  console.log(`Creating limit buy order for ${volume} BTC @ $${price}`)
  await client.createLimitBuyOrder(market, volume, price)
  boughtPrice = price
  console.log(`Created limit buy order for ${volume} BTC @ $${price}`)
}

async function newSellOrder(market, balance, price, client, config) {
  const volume = balance * config.allocation
  console.log(`Creating limit sell order for ${volume} BTC @ $${price}`)
  await client.createLimitSellOrder(market, volume, price)
  soldPrice = price
  console.log(`Created limit sell order for ${volume} BTC @ $${price}`)
}

async function cancelBuyOrder(market) {
  const orders = await binanceClient.fetchOpenOrders(market);
  orders.forEach(async order => {
    if (order.side === 'buy') {
      console.log("Cancelling limit buy order")
      await binanceClient.cancelOrder(order.id, market)
      console.log("Cancelled limit buy order")
    }
  })
}

run();