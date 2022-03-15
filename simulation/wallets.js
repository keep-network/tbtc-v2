const NUM_ITERATIONS = 100
const LOG_LEVEL = 3

const operatorCount = 2000
const threshold = 51
const walletSize = 100
const heartbeat = 70
const operatorQuitChance = 0.005
const expectedNewOperators = 10
const expectedNewDeposits = 30
const expectedNewWithdraws = 25
const walletMaxBtc = 200
const dustThreshold = 1
const maxAge = 30*6 // days
const walletCreationTime = 3 // days

function log(logLevel, message) {
  if (logLevel >= LOG_LEVEL) {
    console.log(message)
  }
}

function fact(x) {
  if(x==0) {
    return 1;
  }
  return x * fact(x-1);
}
function poisson(k, lambda) {
  exponentialPower = Math.pow(2.718281828, -lambda);
  landaPowerK = Math.pow(lambda, k);
  numerator = exponentialPower * landaPowerK;
  denominator = fact(k);
  return (numerator / denominator);
}

function getRandom(length) { return Math.floor(Math.random()*(length)); }
function getRandomSample(array, size) {
  var length = array.length, start = getRandom(length),
    swaps = [], i = size, temp;

  while(i--) {
    var index = (start + i)%length, rindex = getRandom(length);
    temp = array[rindex];
    array[rindex] = array[index];
    array[index] = temp;
    swaps.push({ from: index, to: rindex });
  }

  var end = start + size, sample = array.slice(start, end);
  if(end > length)
    sample = sample.concat(array.slice(0, end - length));

  // Put everything back.
    i = size;
  while(i--) {
    var pop = swaps.pop();
    temp = array[pop.from];
    array[pop.from] = array[pop.to];
    array[pop.to] = temp;
  }

  return sample;
}

var newOperatorCDF = {}
const epsilon = 0.0001
var total = 0
for (let i = 0; total + epsilon <= 1; i++) {
  total += poisson(i, expectedNewOperators)
  newOperatorCDF[i] = total
}
function newOperatorCount() {
  const rng = Math.random()
  var i = 0
  while (true) {
    if (newOperatorCDF[i] >= rng || newOperatorCDF[i] == undefined) {
      return i
    }
    i++
  }
}

var newDepositCDF = {}
total = 0
for (let i = 0; total + epsilon <= 1; i++) {
  total += poisson(i, expectedNewDeposits)
  newDepositCDF[i] = total
}
function randomNewDeposit() {
  const rng = Math.random()
  var i = 0
  while (true) {
    if (newDepositCDF[i] >= rng || newDepositCDF[i] == undefined) {
      return i
    }
    i++
  }
}

var newWithdrawCDF = {}
total = 0
for (let i = 0; total + epsilon <= 1; i++) {
  total += poisson(i, expectedNewWithdraws)
  newWithdrawCDF[i] = total
}

function randomNewWithdraw() {
  const rng = Math.random()
  var i = 0
  while (true) {
    if (newWithdrawCDF[i] >= rng || newWithdrawCDF[i] == undefined) {
      return i
    }
    i++
  }
}

function closeOldWallets(data) {
  const wallets = Object.keys(walletBalances)
  wallets.forEach(wallet => {
    if (data.day >= (wallet * 7) + maxAge) {
      closeWallet({walletIndex: wallet, reason: "too old"})
    }
  })
}

function newDay(data) {
  log(1, "Day " + data.day)
  log(1, "There are " + Object.keys(liveOperators).length + " live operators")
  log(1, "There are " + Object.keys(stakingOperators).length + " staking operators")
  closeOldWallets(data)
  registerNewOperators(data)
  beginUnstakingOperators(data)
  unstakeOperators(data)
  createNewWalletEvent(data)
  dailyDeposit(data)
  dailyWithdraw(data)
}

function beginUnstakingOperators(data) {
  const currentStakingOperators = Object.keys(stakingOperators)
  let unstakingOperatorsToday = []
  currentStakingOperators.forEach(operator => {
    if (Math.random() < operatorQuitChance) {
      delete stakingOperators[operator]
      if (operator in operatorToWallets) {
        const wallets = Object.keys(operatorToWallets[operator])
        wallets.forEach(wallet => {
          let walletStakers = walletStakingOperators[wallet]
          delete walletStakers[operator]
          walletStakingOperators[wallet] = walletStakers
          if (Object.keys(walletStakingOperators[wallet]).length < heartbeat) {
            closeWallet({walletIndex: wallet, reason: "failed heartbeat"})
          }
        })
      }
      unstakingOperatorsToday.push(operator)
    }
  })
  unstakingOperators[data.day + 60] = unstakingOperatorsToday
}

function unstakeOperators(data) {
  const unstakingOperatorsToday = unstakingOperators[data.day]
  if (!!unstakingOperatorsToday) {
    unstakingOperatorsToday.forEach(operator => {
      delete liveOperators[operator]
    })
    delete unstakingOperators[data.day]
  }
}

function registerNewOperators(_) {
  const newOperators = newOperatorCount()
  for (let j = 0; j < newOperators; j++) {
    liveOperators[operatorIndex] = true
    stakingOperators[operatorIndex] = true
    operatorIndex++
  }
}

function createNewWalletEvent(data) {
  if (data.day % 7 == 0) {
    newWallet({walletIndex: walletIndex, day: data.day})
  }
}

function newWallet(data) {
  walletBalances[data.walletIndex] = 0
  const operators = getRandomSample(Object.keys(stakingOperators), 100)
  walletLiveOperators[data.walletIndex] = {}
  walletStakingOperators[data.walletIndex] = {}
  operators.forEach(operator => {
    walletLiveOperators[data.walletIndex][operator] = true
    walletStakingOperators[data.walletIndex][operator] = true
    let wallets = operatorToWallets[operator] || {}
    wallets[data.walletIndex] = true
    operatorToWallets[operator] = wallets
  })
  log(1, "creating new wallet index: " + data.walletIndex)

  walletIndex++
}


function randomTransferWithoutCap(data) {
  let liveWallets = []
  for (let i = 0; i < walletIndex; i++) {
    if (walletBalances[i] > dustThreshold && Object.keys(walletStakingOperators[i]).length >= heartbeat && i != data.walletIndex) {
      liveWallets.push(i) 
    }
  }
  const randomIndex = Math.floor(Math.random() * liveWallets.length)
  const randomWallet = liveWallets[randomIndex]
  log(1, "Transferring " + walletBalances[data.walletIndex] + " btc from Wallet#" + data.walletIndex + " to Wallet#" + randomIndex)
  walletBalances[randomWallet] += walletBalances[data.walletIndex] 
  if (walletBalances[randomWallet] > biggestWalletBalance) {
    biggestWalletBalance = walletBalances[randomWallet]
  }
  numberOfTransfers++
}

function randomTransfer(data) {
  let liveWallets = []
  for (let i = 0; i < walletIndex; i++) {
    if (walletBalances[i] > dustThreshold && Object.keys(walletStakingOperators[i]).length >= heartbeat && i != data.walletIndex) {
      liveWallets.push(i) 
    }
  }
  const transferCount = Math.ceil(walletBalances[data.walletIndex] / walletMaxBtc)
  const randomIndexes = getRandomSample(liveWallets, transferCount)
  let remaining = walletBalances[data.walletIndex]
  randomIndexes.forEach(randomIndex => {
    let transferAmount = 0
    if (remaining > walletMaxBtc) {
      transferAmount = walletMaxBtc
    } else {
      transferAmount = remaining
    }
    remaining -= transferAmount
    const randomWallet = liveWallets[randomIndex]
    log(1, "Transferring " + transferAmount + " btc from Wallet#" + data.walletIndex + " to Wallet#" + randomIndex)
    walletBalances[randomWallet] += transferAmount
    if (walletBalances[randomWallet] > biggestWalletBalance) {
      biggestWalletBalance = walletBalances[randomWallet]
    }
    numberOfTransfers++
  })
}

function transferToActive(data) {
  log(1, "Transferring " + walletBalances[data.walletIndex] + " btc from Wallet#" + data.walletIndex + " to Wallet#" + (walletIndex-1))
  walletBalances[walletIndex-1] += walletBalances[data.walletIndex]
  if (walletBalances[walletIndex-1] > biggestWalletBalance) {
    biggestWalletBalance = walletBalances[walletIndex-1]
  }
  numberOfTransfers++
}

const transfer = randomTransfer

function closeWallet(data) {
  if (data.walletIndex < walletIndex - 1 && data.walletIndex in walletBalances) {
    log(1, "Closing Wallet#" + data.walletIndex + " for reason: " + data.reason)
    if (walletBalances[data.walletIndex] > 0) {
      transfer(data)
    }
    Object.keys(walletStakingOperators[data.walletIndex]).forEach(operator => {
      let wallets = operatorToWallets[operator]
      delete wallets[data.walletIndex]
      operatorToWallets[operator] = wallets
    })
    delete walletStakingOperators[data.walletIndex]
    delete walletLiveOperators[data.walletIndex]
    delete walletBalances[data.walletIndex]
  }
}

function dailyWithdraw(_) {
  let remaining = randomNewWithdraw()
  if (remaining > btcInSystem) {
    log(1, "Tried to withdraw " + remaining + " btc but the system only had " + btcInSystem + " so withdrawing that instead")
    remaining = btcInSystem
  }
  let wallet = 0
  while (remaining > 0) {
    if (walletBalances[wallet] > 0) {
      if (walletBalances[wallet] > remaining) {
        withdraw({walletIndex: wallet, amount: remaining})
        remaining = 0
      } else {
        remaining -= walletBalances[wallet]
        withdraw({walletIndex: wallet, amount: walletBalances[wallet]})
      }
    }
    wallet++
  }
}

function dailyDeposit(_) {
  const amount = randomNewDeposit()
  log(1, "Depositing " + amount + " btc into Wallet#" + (walletIndex-1))
  walletBalances[walletIndex-1] += amount
  if (walletBalances[walletIndex-1] > biggestWalletBalance) {
    biggestWalletBalance = walletBalances[walletIndex-1]
  }
  btcInSystem += amount
}

function withdraw(data) {
  const remainingBalance = walletBalances[data.walletIndex] - data.amount
  log(1, "Withdrawing " + data.amount + " btc from Wallet#" + data.walletIndex + ". Remaining balance: " + remainingBalance)
  walletBalances[data.walletIndex] -= data.amount
  btcInSystem -= data.amount
  if (remainingBalance <= dustThreshold) {
    closeWallet({walletIndex: data.walletIndex, reason: "below dust"})
  }
}

let biggestWalletBalance = 0
let btcInSystem = 0
let currentlyCreatingWallet = false
let lastWalletCreationDay = -7
let liveOperators = {}
let numberOfTransfers = 0
let operatorIndex = 0
let operatorToWallets = {}
let stakingOperators = {}
let totalBiggestWalletBalance = 0
let unstakingOperators = {}
let walletBalances = {}
let walletIndex = 0
let walletLiveOperators = {}
let walletStakingOperators = {}
let walletStartCreationDay = 0

for (let iteration = 0; iteration < NUM_ITERATIONS; iteration++) {
  biggestWalletBalance = 0
  btcInSystem = 0
  currentlyCreatingWallet = false
  lastWalletCreationDay = -7
  liveOperators = {}
  operatorIndex = 0
  operatorToWallets = {}
  stakingOperators = {}
  unstakingOperators = {}
  walletBalances = {}
  walletIndex = 0
  walletLiveOperators = {}
  walletStakingOperators = {}
  walletStartCreationDay = 0

  for (let i=0; i<2000; i++) {
    liveOperators[i] = true
    stakingOperators[i] = true
    operatorIndex++
  }

  for (let i = 0; i < 365*2; i++) {
    newDay({day: i})
  }
  totalBiggestWalletBalance += biggestWalletBalance
}
log(3, "biggestWalletBalance: " + totalBiggestWalletBalance / NUM_ITERATIONS)
