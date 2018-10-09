/**
 * This code is created for the Pulse Sensor Amped open platform and based on the code they kindly made available
 */

/**
 * Custom blocks
 */

//% weight=59 color=#444A84 icon="\uf051" block="DOT Graphing"

namespace graphing {

    export function integerMap(value: number, inputLow: number, inputHigh: number, outputLow: number, outputHigh: number): number {
        return (value - inputLow) * (outputHigh - outputLow) / (inputHigh - inputLow) + outputLow
    }

    /**
    * helper function for mapping calculation brings any number to 25
    * this means we can use the LEDs to graph nicely
    * @param value describe value here eg: 216
    * @param target describe target here eg: 10000
    */

    //% block "map your $value out of $target to a number out of 25"
    export function mapTo25(value: number, target: number): number {
        return integerMap(value, 0, target, 0, 25) - 1
    }

    /**
    * graphs 'number' out of 'target' on the LED screen
    * @param value describe value here, eg: 5, 9, 3
    * @param target describe target here, eg, 100
    */
    //% block="screenGraph $value out of $target"
    //% value.min=0
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
                led.plot(0, (index / 5))
            }
        }
    }
}

//% weight=58 color=#444A84 icon="\uf118" block="DOT Pulse Calculation"
//% groups=['1: basics', '2: behind the scenes', '3: test functions']
namespace calculation {
    let activityPoints: number = 0
    let activityTarget: number = 100
    let moderatePulseLowBound: number = 0
    let moderateVigorousBoundary: number = 0
    let vigorousPulseHighBound: number = 0
    let maximumPulse: number = 0
    let heartRateReserve: number = 0
    let totalActivityPoints: number = 0
    let tempVar: number = 0

    /**
     * @param age eg:12
     * @param restRate eg:70
     */
    //% block="calculate target zone using age:$age and resting Heart Rate: $restRate"
    //% group='1: basics'
    export function calcModVig(age: number, restRate: number) {
        maximumPulse = 220 - age
        heartRateReserve = maximumPulse - restRate
        moderatePulseLowBound = (heartRateReserve / 2) + restRate
        moderateVigorousBoundary = Math.round((heartRateReserve * .7) + restRate)
        vigorousPulseHighBound = Math.round((heartRateReserve * .85) + restRate)
    }



    /**
     * how much activity you should be doing this week
     */
    //% block="activity target"
    //% group='1: basics'
    export function getActivityTarget() {
        return activityTarget
    }

    /**
     * how much activity you have done since you turned on the micro:bit
     */
    //% block='activity points'
    //% group='1: basics'
    export function getActivityPoints() {
        return totalActivityPoints / 30       // We use 30 because we have a 2-second sample period.
    }

    /**
     * 
     */
    //% block="calculate activity points"
    //% group='1: basics'
    export function calcActivityPoints() {
        if (checkPulseLevel() == 4) {
            totalActivityPoints += 4
        } else if (checkPulseLevel() == 2) {
            totalActivityPoints += 2
        }
    }



    //% block='set activity target to $value'
    //% group='2: behind the scenes'
    export function setActivityTarget(value: number) {
        activityTarget = value
    }

    //% block='moderate pulse lower bound'
    //% group='2: behind the scenes'
    export function getMPLB() {
        return moderatePulseLowBound
    }

    //% block='moderate-vigorous boundary'
    //%group='2: behind the scenes'
    export function getMVB() {
        return moderateVigorousBoundary
    }

    //% block='vigorous pulse high bound'
    //% group='2: behind the scenes'
    export function getVPHB() {
        return vigorousPulseHighBound
    }

    //% block='maximum pulse rate'
    //% group='2: behind the scenes'
    export function getMPR() {
        return maximumPulse
    }

    //% block='heart rate reserve'
    //% group='2: behind the scenes'
    export function getHRR() {
        return heartRateReserve
    }

    /**
         * how much activity you have done since you turned on the micro:bit
         */
    //% block='total activity points'
    //% group='3: test functions'
    export function getTotalActivityPoints() {
        return totalActivityPoints
    }

    /**
     * returns a 1 for light, 2 for moderate and a 4 for vigorous exercise.  -1 means there is an error
     */
    //% block='check pulse level'
    //% group='2: behind the scenes'
    export function checkPulseLevel(): number {
        // requires enough pulse values in pulse.whatever to use for a historical average.
        // returns a -1, 1, 2 or 4.
        let samples: number[] = amped.getBPMSamples()
        let n: number = 0
        let m: number = samples.length

        for (let i: number = 0; i < samples.length; i++) {
            n += samples[i]
        }
        n = Math.round(n / m)
        tempVar = n
        if (n <= vigorousPulseHighBound && n > moderateVigorousBoundary) {       // high
            tempVar = 40
            return 4
        }
        else if (n <= moderateVigorousBoundary && n > moderatePulseLowBound) {     // moderate
            tempVar = 20
            return 2
        }
        else if (n <= moderatePulseLowBound) {        // light
            return 1
        }
        else return -1                          // We're too high, so error out
    }

    //% block='get tempVar, a test variable'
    //% group='3: test functions'
    export function getTempVar() {
        return tempVar
    }

    //% block='set activity points to $value'
    //% group='3: test functions'
    export function setActivityPoints(value: number) {
        activityPoints = value
    }

    //% block='set moderate lower bound to $value'
    //% group='3: test functions'
    export function setLowerBound(value: number) {
        moderatePulseLowBound = value
    }

    //% block='set moderate-vigorous boundary to $value'
    //% group='3: test functions'
    export function setMidBoundary(value: number) {
        moderateVigorousBoundary = value
    }
}

//% weight=60 color=#444A84 icon="\uf051" block="DOT Pulse"
//% groups=['1: basics', '2: behind the scenes']
namespace amped {

    let sampleIntervalMS = 20

    let rate: number[] = []
    let values: number[] = []
    let lastBPMSamples: number[] = []     // EXPECTED BY calculation.checkPulseLevel()

    function initialSeeding() {
        // 2 seconds of data required
        let samples: number = 2000 / sampleIntervalMS
        for (let i: number = 0; i < samples; i++) {
            rate.push(0)
            values.push(0)
            lastBPMSamples.push(70)
        }
    }

    initialSeeding()

    let inputPin: AnalogPin = AnalogPin.P0
    let QS: boolean = false
    let BPM = 1
    let IBI = 600                                     // InterBeat Interval, ms
    let pulse = false
    let lastBeatTime: number = input.runningTime()
    let Peak: number = 512
    let Trough: number = 512
    let threshSetting: number = 0
    let thresh: number = threshSetting
    let sensitivity: number = 90                          // Skin opacity and blood vessel layout matter
    let amp = 100 // amplitude is 1/10thish of input range.  May alter for 3.3V
    let firstBeat = true  // looking for the first beat
    let secondBeat = false // not yet looking for the second beat in a row
    let signal: number = 0
    let rising: boolean = false
    let rateTotal: number = 0                           // tracks time taken for IBI
    let runningTotal: number = 0                        // } We use these to track if we are rising or falling
    let lastTotal: number = 0                           // }


    export function getBPMSamples() {
        return lastBPMSamples
    }

    //% block="set input pin to $pin"
    //% group='1: basics'
    export function setPinNumber(pin: AnalogPin) {
        inputPin = pin
    }

    //% block
    //% group='2: behind the scenes'
    export function getSampleInterval() {
        return sampleIntervalMS
    }

    function getSensitivity() {
        return sensitivity
    }

    //% block
    //% group='2: behind the scenes'
    export function setSampleInterval(value: number) {
        sampleIntervalMS = value
    }

    function mapPinToSample(value: number) {
        return pins.map(value, 500, 1023, 0, 1023)
    }

    /**
     * gets Beats Per Minute, which we calculate as we go along
     */
    //% block="BPM"
    //% group='1: basics'
    export function getBPM() {
        return BPM
    }

    //% block="current value"
    //% group='2: behind the scenes'
    export function getLatestSample() {   // We're currently sampling from the end for no reason I can really recall...
        return values[values.length - 2]
    }

    /**
     * get amplitude of signal (how big from highest to lowest)
     */
    //% block="amp"
    //% group='2: behind the scenes'
    export function getAmp() {
        return amp
    }

    /**
    * show Inter-Beat Interval
    */
    //% block="IBI"
    //% group='2: behind the scenes'
    export function getIBI() {
        return IBI
    }

    function getLastBeatTime() {
        return lastBeatTime
    }


    function isInsideBeat() {
        return pulse
    }

    function triangleSmooth(array: number[], weighting: number): number {
        if (array.length == 0) { return 0 }
        if (weighting == 0) {
            weighting = 1
        }
        if (!(array.length & 1)) {                                          // masking with 1, and finding out if we get a true or false back, to see if we are odd or even.
            array.pop()
        }
        let mid: number = Math.round(array.length / 2 + 0.5)
        let total: number = 0
        for (let i: number = 0; i < mid; i++) {
            total += array[i] * (weighting * i + 1)
        }
        for (let i: number = mid; i < array.length; i++)
            total += array[i] * (weighting) * (array.length - i)
        return total / array.length * weighting
    }

    /**
     * takes a reading from the pin connected to the pulse meter
     */
    //% block="read (and save) pulse value"
    //% group='1: basics'
    export function readNextSample() {
        // assume that reading is atomic, perfect, complete, and does not get in the way of other things
        moveThresh(values.shift())
        let value: number = Math.round(pins.analogReadPin(inputPin))   // !! magic number - 500 is the usual floating voltage, and offsetting here stops overflow spikes in thresh calculation
        moveThresh(value)
        values.push(value)
        signal = value
    }

    function updateRunningTotal() {
        runningTotal = Math.round(values[values.length - 2] + (values[values.length - 3]))// + values[values.length - 1]))
    }

    function calculateRunningTotal() {  // used if we believe that the running total is out of synch
        lastTotal = runningTotal
        updateRunningTotal()
    }

    /**
     * set threshold
     */
    function setThresh(newThresh: number): void {
        thresh = newThresh
    }

    function moveThresh(shift: number) {
        if (shift == 0)
        { return }
        thresh += Math.round(shift / 10)           // this gives us a better idea of amplitude - how big the pulsebeat is
    }

    function findAmp() {
        return (Peak - Trough)
    }

    function findMax(array: number[]) {                            // !! highly inefficient, but we deal with that once it works
        let peak: number = array[0]
        for (let i: number = 1; i < array.length; i++) {
            if (array[i] > peak) {
                peak = array[i]
            }
        }
        return peak
    }

    function findMin(array: number[]) {                           // !! highly inefficient, but we deal with that once it works
        let trough: number = array[0]
        for (let i: number = 1; i < array.length; i++) {
            if (array[i] < trough) {
                trough = array[i]
            }
        }
        return trough
    }

    function setAmp(value: number) {
        amp = value
    }

    function pulseOver() {
        pulse = false
        rising = false
        setAmp(findAmp())
        Peak = thresh
        Trough = thresh
        rate[9] = IBI
        rateTotal += rate[9]
        rateTotal /= 10                                 // this gives us an average, so we avoid spikes
        BPM = Math.round(60000 / rateTotal)             // 60,000ms = 60secs
        lastBPMSamples.push(BPM)
        lastBPMSamples.shift()
        QS = true                                       // Quantified Self (detected a beat!)

    }

    function newPulse(N: number) {
        pulse = true
        IBI = N
        lastBeatTime = input.runningTime()
    }

    /**
     * finds if we are in a pulse already, or have just started one
     */
    //% block="process current pulse value"
    //% group='1: basics'
    export function processLatestSample() {
        let N: number = input.runningTime() - lastBeatTime          // N is a time interval
        calculateRunningTotal()                                     // also updates last total

        // find the peak/trough of the pulse wave.
        let Max = findMax(values)                             //!! Here, we die of inefficiency and sorrow
        let Min = findMin(values)
        setAmp(Max - Min)

        if (N > 250) {                                              // more than a quarter of a second since the last pulse
            if (runningTotal > lastTotal) { // The pulse jumps up pretty quickly.
                rising = true
            }

            if ((pulse == false) && (N > (IBI / 5) * 3) && rising == true && amp > 100) {
                newPulse(N)                                  // sets pulse to true, sets IBI to N, moves lastBeatTime to input.runningTime
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

                for (let i = 0; i < rate.length; i++) {
                    rate[i] = rate[i + 1]                   // we could do this with shift, but we'd still have to do the next line...
                    rateTotal += rate[i]
                    let a: number = values[i]
                    if (a > Peak)
                    { Peak = a }
                    if (a < Trough)
                    { Trough = a }
                }

            }
        }

        if (lastTotal > runningTotal && (pulse == true)) {  // values are going down, so the beat is over
            pulseOver()
        }

        if (N > 2500) {                             // 2.5 seconds without a beat means we need to reset
            thresh = (Peak + Trough) / 2
            Peak = 512
            Trough = 512
            lastBeatTime = input.runningTime()
            firstBeat = true                        // look once more for the first beat
            secondBeat = false
            QS = false
            BPM = 0
            IBI = 600
            pulse = false
            amp = 90
            calculateRunningTotal()                 // Might as well.  We're not doing anything else.
        }
    }
}
