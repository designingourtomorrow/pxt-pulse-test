/**
sampleLengthMS
 * This code is created for the Pulse Sensor Amped open platform and based on the code they kindly made available
 */

/**
 * Custom blocks
 */

//% weight=58 color=#00004c icon="\uf118" block="DOT Pulse"
//% groups=['1: Core Blocks', '2: Extension Blocks', '3: Useful Variables']

namespace dotPulse {

    let sampleIntervalMS = 20

    let rate: number[] = []
    let sampleArray: number[] = []
    let lastBPMSamples: number[] = []       // EXPECTED BY checkPulseLevel()
    let averageFiller: number = 500         // A clean number to fill in average values

    let sampleLengthMS: number = 2000                           // 2 seconds is the norm, but should not be relied on.
    let BPMLength = sampleLengthMS / sampleIntervalMS
    let rateLength = sampleLengthMS / sampleIntervalMS

    function initialSeeding() {
        // 2 seconds of data required
        let samples: number = sampleLengthMS / sampleIntervalMS
        for (let i: number = 0; i < samples; i++) {
            sampleArray.push(averageFiller)
            lastBPMSamples.push(0)
        }
        for (let i: number = 0; i < 10; i++) {
            rate.push(0)
        }
    }

    initialSeeding()

    // amped pulse calculation
    let inputPin: AnalogPin = AnalogPin.P0
    let BPM = 0
    let IBI = 600                                           // InterBeat Interval, ms
    let pulse = false
    let lastBeatTime: number = input.runningTime()
    let Peak: number = 0
    let Trough: number = 1023
    let averageSignal = averageFiller
    let triggerOffset: number = 50                          // stays up above average this way.
    let firstBeat = true  // looking for the first beat
    let secondBeat = false // not yet looking for the second beat in a row
    let signal: number = 0
    let rising: boolean = false
    let rateTotal: number = 0                           // tracks time taken for IBI
    let runningTotal: number = 0                        // } We use these to track if we are rising or falling
    let lastTotal: number = 0                           // }

    function getBPMSamples() {
        return lastBPMSamples
    }

    /**
    * view pulse on LEDs as it happens
    * @param value eg: 5 
    */
    //% block="view pulse on LEDs for $value seconds"
    //% value.min=1 value.max=15
    //% blockGap=6
    //% group='1: Core Blocks'
    export function viewPulseFor(value: number) {
        let time = input.runningTime()
        while (input.runningTime() <= time + 1000 * value) {
            led.plotBarGraph(
                pins.analogReadPin(AnalogPin.P0),
                1023
            )
            basic.pause(100)
        }
        basic.showLeds(`
        . . # . .
        . # # . .
        # # # . #
        . . # # .
        . . # . .
        `)
    }
    /**
    * process your pulse and record it on the micro:bit
    */
    //% block="process pulse"
    //% blockGap=16
    //% group='1: Core Blocks'
    export function processPulse() {
        for (let i = 0; i < getSampleLength() / getSampleInterval(); i++) {
            readNextSample()
            processLatestSample()
            basic.pause(getSampleInterval())
        }
    }


    //% block="set input pin to $pin"
    //% advanced=true
    //% group='1: Core Blocks'
    export function setPinNumber(pin: AnalogPin) {
        inputPin = pin
    }


    /**
     * set your target for time spent in high or moderate activity
     * @param value eg: 100
     */
    //% block='set activity target to $value'
    //% blockGap=6
    //% group='1: Core Blocks'
    export function setActivityTarget(value: number) {
        activityTarget = value
    }

    /**
     * use this to start at a number that is not 0
     * @param value eg: 20
     */
    //% block='set activity points to $value'
    //% group='2: Extension Blocks'
    //% blockGap=16
    export function setActivityPoints(value: number) {
        totalActivityPoints = (value * 30)
    }

    /**
    * a measure of sensitivity when looking at the pulse
    * @param value eg: 30
    */
    //% block="set sensitivity to $value"
    //% advanced=true
    //% value.min=0 value.max=50
    //% group='1: Core Blocks'
    export function setTriggerOffset(value: number) {
        triggerOffset = 50 - value
    }

    function getAverageSignal(): number {
        return averageSignal
    }

    //% block
    //% advanced=true
    export function setSampleInterval(value: number) {
        sampleIntervalMS = value
    }

    /**
       * a measure of sensitivity when looking at the pulse
       */
    //% block="trigger level"
    //% advanced=true
    //% blockGap=6
    export function getTriggerLevel() {
        return triggerOffset + averageSignal
    }

    //% block="current value"
    //% advanced=true
    //% blockGap=6
    export function getRawSample() {
        return sampleArray[sampleArray.length - 1]
    }



    /**
    * show Inter-Beat Interval
    */
    //% block="Inter-Beat Interval"
    //% advanced=true
    //% blockGap=6
    export function getIBI() {
        return IBI
    }

    function getLastBeatTime() {
        return lastBeatTime
    }

    //% block="sample interval (ms)"
    //% advanced=true
    //% blockGap=6
    export function getSampleInterval() {
        return sampleIntervalMS
    }

    /**
     * sample length in MS
     */
    //% block="sample length (ms)"
    //% advanced=true
    //% blockGap=16
    export function getSampleLength() {
        return sampleLengthMS
    }

    function findAverageSignal(newSample: number, discard: number) {
        averageSignal += Math.round(newSample / sampleArray.length)
        averageSignal -= Math.round(discard / sampleArray.length)
    }


    function newPulse() {
        IBI = input.runningTime() - lastBeatTime
        lastBeatTime = input.runningTime()
        rateTotal = 0
        rate[9] = IBI
        for (let i: number = 0; i < 9; i++) {
            rate[i] = rate[i + 1]
            rateTotal += rate[i]
        }
        rateTotal += rate[9]
        rateTotal /= 10                                 // this gives us an average, so we avoid spikes
        BPM = Math.round(60000 / rateTotal)             // 60,000ms=60secs
        lastBPMSamples.push(BPM)
        lastBPMSamples.shift()
    }

    function resetBeat() {
        Peak = 0
        Trough = 1023
        firstBeat = true
        secondBeat = false
        lastBeatTime = input.runningTime()
        BPM = 0
        IBI = 600
    }

    function getLastSample() {
        return sampleArray[sampleArray.length - 1]
    }

    function isValidBeatTime(): boolean {
        if (lastBeatTime + 250 < input.runningTime()) {  // If your heart is beating more than 4 times a second, you have a different problem
            return true
        }
        return false
    }

    /**
    * takes a reading from the pin connected to the pulse meter
    */
    //% block="take pulse sample"
    //% blockGap=6
    //% group="2: Extension Blocks""
    export function readNextSample() {
        // assume that reading is atomic, perfect, complete, and does not get in the way of other things

        let newSample: number = pins.analogReadPin(inputPin)
        sampleArray.push(newSample)
        let discard: number = sampleArray.shift()
        findAverageSignal(newSample, discard)
    }


    /**
     * finds if we are in a pulse already, or have just started one
     */
    //% block="process latest sample"
    //% blockGap=16
    //% group='2: Extension Blocks'
    export function processLatestSample() {

        // checks if the peak in a new sample is really the start of a beat
        if (sampleArray[sampleArray.length - 1] > (sampleArray[sampleArray.length - 2]) && (getLastSample() > getTriggerLevel())) {
            // we are rising.
            rising = true
        }

        else if (rising == true && isValidBeatTime() && (getLastSample() < getTriggerLevel()) && sampleArray[sampleArray.length - 1] < sampleArray[sampleArray.length - 2]) {
            rising = false
            newPulse()                                  // sets pulse to true, sets IBI to N, moves lastBeatTime to input.runningTime
            if (secondBeat) {
                secondBeat = false                      // We are no longer looking for the second beat
                for (let i = 0; i < 10; i++) {
                    rate[i] = IBI                       // Seed the running total to take a quick stab at the BPM
                }
            }

            if (firstBeat) {
                firstBeat = false
                secondBeat = true
                // We can't yet use IBI to seed the running total, but we can check again for the second beat
                return   // bug out for the moment...
            }

        }
        if (input.runningTime() - lastBeatTime > 2000) {
            resetBeat()
        }
    }

    export function integerMap(value: number, inputLow: number, inputHigh: number, outputLow: number, outputHigh: number): number {
        return Math.round((value - inputLow) * (outputHigh - outputLow) / (inputHigh - inputLow) + outputLow)
    }

    /**
    * helper function for mapping calculation brings any number to 25
    * this means we can use the LEDs to graph nicely
    * @param value describe value here eg: 21
    * @param target describe target here eg: 100
    */

    export function mapTo25(value: number, target: number): number {
        return integerMap(value, 0, target, 0, 25) - 1
    }

    let activityPoints: number = 0
    let activityTarget: number = 100
    let moderatePulseLowBound: number = 0
    let moderateVigorousBoundary: number = 0
    let vigorousPulseHighBound: number = 0
    let maximumPulse: number = 0
    let heartRateReserve: number = 0
    let totalActivityPoints: number = 0

    /**
     * @param age eg:12
     * @param restRate eg:70
     */
    //% block="calculate target zone using age:$age and resting Heart Rate: $restRate"
    //% group='1: Core Blocks'

    export function calcModVig(age: number, restRate: number) {
        maximumPulse = 220 - age
        heartRateReserve = maximumPulse - restRate
        moderatePulseLowBound = (heartRateReserve / 2) + restRate
        moderateVigorousBoundary = Math.round((heartRateReserve * .7) + restRate)
        vigorousPulseHighBound = Math.round((heartRateReserve * .85) + restRate)

    }

    /**
     * checks the most recent BPM calculation for what sort of exercise it implies
     */
    //% block="calculate activity points"
    //% blockGap=6
    //% group='1: Core Blocks'
    export function calcActivityPoints() {
        if (checkPulseLevel() == 4) {
            totalActivityPoints += 4
        } else if (checkPulseLevel() == 2) {
            totalActivityPoints += 2
        }
    }


    /**
     * activity in minutes of moderate or half minutes of vigorous exercise
     */
    //% block='activity points'
    //% blockGap=6
    //% group="1: Core Blocks"
    export function getActivityPoints() {
        return Math.round(totalActivityPoints / 30)       // We use 30 because we have a 2-second sample period.
    }

    /**
     * activity target, in minutes of vigorous exercise
     * moderate exercise will count for half
     */
    //% block="activity target"
    //% blockGap=6
    //% group="1: Core Blocks"
    export function getActivityTarget() {
        return activityTarget
    }


    /**
     * gets Beats Per Minute, which we calculate as we go along
     */
    //% block="BPM"
    //% blockGap=6
    //% group='1: Core Blocks'
    export function getBPM() {
        return BPM
    }


    /**
    * graphs 'number' out of 'target' on the LED screen
    * @param value describe value here, eg: 5
    * @param target describe target here, eg: 100
    */
    //% block="track $value out of $target"
    //% value.min=0 target.min=1
    export function graphOnScreen(value: number, target: number): void {
        if (value > target) {
            value = target
        }
        let screenValue = mapTo25(value, target)
        if (screenValue == 0) {
            basic.clearScreen()
        } else {
            basic.clearScreen()
            basic.pause(500)
            for (let index = 0; index <= screenValue; index++) {
                led.plot(index % 5, 4 - (Math.floor(index / 5)))
            }
        }
    }


    function getMPLB() {
        return moderatePulseLowBound
    }

    function getMVB() {
        return moderateVigorousBoundary
    }

    function getVPHB() {
        return vigorousPulseHighBound
    }

    function getMPR() {
        return maximumPulse
    }

    function getHRR() {
        return heartRateReserve
    }

    /**
     * returns a 1 for light, 2 for moderate and a 4 for vigorous exercise.  -1 means there is an error
     */
    // % block='current pulse level'
    // % advanced=true
    function checkPulseLevel(): number {
        // requires enough pulse values in pulse.whatever to use for a historical average.
        // returns a -1, 1, 2 or 4.
        let samples: number[] = getBPMSamples()
        let n: number = 0
        let m: number = samples.length

        for (let i: number = 0; i < samples.length; i++) {
            n += samples[i]
        }
        n = Math.round(n / m)
        if (n <= vigorousPulseHighBound && n > moderateVigorousBoundary) {       // high
            return 4
        }
        else if (n <= moderateVigorousBoundary && n > moderatePulseLowBound) {     // moderate
            return 2
        }
        else if (n <= moderatePulseLowBound) {        // light
            return 1
        }
        else return -1                          // We're too high, so error out
    }
}
