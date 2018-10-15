/**
sampleLengthMS
 * This code is created for the Pulse Sensor Amped open platform and based on the code they kindly made available
 */

/**
 * Custom blocks
 */

//% weight=58 color=#EBEBFF icon="\uf118" block="DOT Pulse"

namespace dotPulse {

    let sampleIntervalMS = 20

    let rate: number[] = []
    let values: number[] = []
    let lastBPMSamples: number[] = []       // EXPECTED BY calculation.checkPulseLevel()

    let sampleLengthMS: number = 2000       // 2 seconds is the norm, but should not be relied on.
    let BPMLength = sampleLengthMS / sampleIntervalMS           // !! not what we'll eventually use, but workable for the moment
    let rateLength = sampleLengthMS / sampleIntervalMS


    function initialSeeding() {
        // 2 seconds of data required
        let samples: number = sampleLengthMS / sampleIntervalMS
        for (let i: number = 0; i < samples; i++) {
            rate.push(0)
            values.push(0)
            lastBPMSamples.push(0)
        }
    }

    initialSeeding()


    // amped pulse calculation
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
    let triggerLevel: number = 90                          // Skin opacity and blood vessel layout matter
    let amp = 100 // amplitude is 1/10thish of input range.  May alter for 3.3V
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
    * view pulse on LEDs to check you are reading it right
    * @param value eg: 5 
    */
    //% block="view pulse on LEDs for $value seconds"
    //% value.min=1
    //% blockGap=6
    export function viewPulseFor(value: number) {
        for (let i = 0; i < value * 10; i++) {
            led.plotBarGraph(getLatestSample(), 1023)
            basic.pause(100)
        }
        basic.clearScreen()
    }

    /**
    * process your pulse and record it on the micro:bit
    */
    //% block="process pulse"
    //% blockGap=14
    export function processPulse() {
        for (let i = 0; i < getSampleLength() / getSampleInterval(); i++) {
            readNextSample()
            processLatestSample()
            basic.pause(getSampleInterval())
        }
    }

    //% block="set input pin to $pin"
    //% advanced=true
    export function setPinNumber(pin: AnalogPin) {
        inputPin = pin
    }

    /**
    * a measure of sensitivity when looking at the pulse
    */
    //% block="set trigger level to $value"
    //% advanced=true
    export function setTriggerLevel(value: number) {
        triggerLevel = value
    }

    //% block
    //% advanced=true
    export function setSampleInterval(value: number) {
        sampleIntervalMS = value
    }

    // function mapPinToSample(value: number) {         // required if we offset values for easier calculation
    //     return pins.map(value, 500, 1023, 0, 1023)
    // }

    /**
       * a measure of sensitivity when looking at the pulse
       */
    //% block="trigger level"
    //% advanced=true
    //% blockGap=6
    export function getTriggerLevel() {
        return triggerLevel
    }


    /**
     * gets Beats Per Minute, which we calculate as we go along
     */
    //% block="BPM"
    //% advanced=true
    //% blockGap=6
    export function getBPM() {
        return BPM
    }

    //% block="current value"
    //% advanced=true
    //% blockGap=6
    export function getLatestSample() {   // We're currently sampling from the end for no reason I can really recall...
        return values[values.length - 2]
    }

    /**
     * get amplitude of signal (how big from highest to lowest)
     */
    //% block="amplitude"
    //% advanced=true
    //% blockGap=6
    export function getAmp() {
        return amp
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
    //% blockGap=8
    export function getSampleLength() {
        return sampleLengthMS
    }


    /**
     * takes a reading from the pin connected to the pulse meter
     */
    //% block="read (and save) pulse value"
    //% advanced=true
    //% blockGap=6
    export function readNextSample() {
        // assume that reading is atomic, perfect, complete, and does not get in the way of other things
        moveThresh(values.shift())
        let value: number = Math.round(pins.analogReadPin(inputPin))
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
        BPM = Math.round(60000 / rateTotal)             // 60,000ms=60secs
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
    //% advanced=true
    //% blockGap=8
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

            if ((pulse == false) && (N > (IBI / 5) * 3) && rising == true && amp > triggerLevel) {
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
            amp = 100
            calculateRunningTotal()                 // Might as well.  We're not doing anything else.
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
    let tempVar: number = 0                                           // only used for serial testing, to pull out numbers cleanly

    /**
     * @param age eg:12
     * @param restRate eg:70
     */
    //% block="calculate target zone using age:$age and resting Heart Rate: $restRate"

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
    export function calcActivityPoints() {
        if (checkPulseLevel() == 4) {
            totalActivityPoints += 4
        } else if (checkPulseLevel() == 2) {
            totalActivityPoints += 2
        }
    }

    /**
     * how much activity you have done since you turned on the micro:bit
     */
    //% block='activity points'
    //% blockGap=6
    export function getActivityPoints() {
        return Math.round(totalActivityPoints / 30)       // We use 30 because we have a 2-second sample period.
    }

    /**
     * activity target, in minutes of vigorous exercise
     * moderate exercise will count for half
     */
    //% block="activity target"
    //% blockGap=14
    export function getActivityTarget() {
        return activityTarget
    }



    /**
    * graphs 'number' out of 'target' on the LED screen
    * @param value describe value here, eg: 5, 9, 3
    * @param target describe target here, eg: 100
    */
    //% block="track $value out of $target"
    //% value.min=0
    export function graphOnScreen(value: number, target: number): void {
        if (value > target) {
            value = target
        }
        let screenValue = mapTo25(value, target)
        if (screenValue == 0) {
            basic.clearScreen()
        } else {
            tempVar = screenValue
            basic.clearScreen()
            basic.pause(500)
            for (let index = 0; index <= screenValue; index++) {
                led.plot(index % 5, index / 5)
            }
        }
    }


    //% block='set activity target to $value'
    //% advanced=true
    //% blockGap=4
    export function setActivityTarget(value: number) {
        activityTarget = value
    }

    //% block='moderate pulse lower bound'
    //% advanced=true
    //% blockGap=4
    export function getMPLB() {
        return moderatePulseLowBound
    }

    //% block='moderate-vigorous boundary'
    //% advanced=true
    //% blockGap=4
    export function getMVB() {
        return moderateVigorousBoundary
    }

    //% block='vigorous pulse high bound'
    //% advanced=true
    //% blockGap=4
    export function getVPHB() {
        return vigorousPulseHighBound
    }

    //% block='maximum pulse rate'
    //% advanced=true
    //% blockGap=4
    export function getMPR() {
        return maximumPulse
    }

    //% block='heart rate reserve'
    //% advanced=true
    //% blockGap=6
    export function getHRR() {
        return heartRateReserve
    }

    /**
    * how much activity you have done since you turned on the micro:bit
    
    //% block='total activity points'
    export function getTotalActivityPoints() {
        return totalActivityPoints
    }
    */

    /**
     * returns a 1 for light, 2 for moderate and a 4 for vigorous exercise.  -1 means there is an error
     */
    //% block='current pulse level'
    //% advanced=true
    export function checkPulseLevel(): number {
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

    /**
     * We only need this for testing.
    */
    //% block='get tempVar, a test variable'
    export function getTempVar() {
        return tempVar
    }

    //% block='set activity points to $value'
    export function setActivityPoints(value: number) {
        totalActivityPoints = (value * 30)
    }

    /** //% block='set moderate lower bound to $value'
    export function setLowerBound(value: number) {
        moderatePulseLowBound=value
    }

    //% block='set moderate-vigorous boundary to $value'
    export function setMidBoundary(value: number) {
        moderateVigorousBoundary=value
    }
    */

}
