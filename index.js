const {env} = process
const moment = require('moment')
const {Primedice} = require('casinos')
const config = require('./config')

const {token, strategies} = config
const strategySelected = env.STRATEGY || 50
const goalToVault = env.goalToVault || 0.00005
const coin = env.COIN || 'doge'

const primedice = new Primedice(token)

const calcBaseAmount = (balance, increment, endurance) => balance * (1-increment)/(1-increment**endurance)
const now = () => moment().format('h:mm:ss')


const main = async () => {
    const strategy = strategies[strategySelected]
    const {condition, endurance, increment, target} = strategy
    let balance = await primedice.getBalance(coin)
    let baseAmount = calcBaseAmount(balance, increment, endurance)
    
    let looseInRow = 0
    let maxLoose = 0
    let toVault = 0
    
    while(true) {
      const amount = baseAmount * increment ** looseInRow
  
      try {
        const betResponse = await primedice.placeBet({coin, amount, target, condition})
        const {primediceRoll} = betResponse
        
        if(primediceRoll.payout > 0) {
          const profit = primediceRoll.payout - baseAmount*(1-increment**looseInRow)/(1-increment) - baseAmount*increment**looseInRow
          toVault += profit * 0.1
  
          if(toVault > balance * goalToVault) {
            primedice.depositToVault({coin, amount: toVault})
            toVault = 0
            balance = await primedice.getBalance(coin)
            baseAmount = calcBaseAmount(balance, increment, endurance)
          }
  
          console.log('win', now(), coin, profit.toFixed(8), 'maxLoose', maxLoose, 'looseInRow', looseInRow)
          
          looseInRow = 0
        } else {
          looseInRow++
          if(looseInRow > maxLoose) {
            maxLoose = looseInRow
            console.log(now(), 'maxLoose:', maxLoose)
          }
        }
      } catch (error){
        const waitedTime = 2*60*1000 
        const err = await new Promise(r => setTimeout(()=> r(`Error ${error}, waited ${waitedTime}ms`), waitedTime)) //wait 2min for next try
        console.log(err)
      }
    }
  }
  
  main()