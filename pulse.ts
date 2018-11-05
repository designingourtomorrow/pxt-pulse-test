/**
sampleLengthMS
 * This code is created for the Pulse Sensor Amped open platform and based on the code they kindly made available
 */

/**
 * Custom blocks
 */

//% weight=58 color=#00004c icon="\uf118" block="DOT Pulse"
//% groups=['1: Basic Blocks', '2: Advanced', '3: Useful Numbers']

namespace dotPulse {

    let sampleIntervalMS = 20

    let rate: number[] = []
    let sampleArray: number[] = []
    let smoothedValues: number[] = []
    let lastBPMSamples: number[] = []       // EXPECTED BY checkPulseLevel()

    let sampleLengthMS: number = 2000                           // 2 seconds is the norm, but should not be relied on.
    let BPMLength = sampleLengthMS / sampleIntervalMS
    let rateLength = sampleLengthMS / sampleIntervalMS
    let smoothingCoefficient: number = 3                        // how many samples do we use to work out 'average'?


    function initialSeeding() {
        // 2 seconds of data required
        let samples: number = sampleLengthMS / sampleIntervalMS
        for (let i: number = 0; i < samples; i++) {
            sampleArray.push(0)
            smoothedValues.push(0)
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
    let lastBeatTime: number = 0
    let Peak: number = 0
    let Trough: number = 1023
    let averageSignal = 0
    let triggerOffset: number = 90                          // stays up above average this way.
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
    //% group='1: Basic Blocks'
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
    //% blockGap=14
    //% group='1: Basic Blocks'
    export function processPulse() {
        for (let i = 0; i < getSampleLength() / getSampleInterval(); i++) {
            readNextSample()
            processLatestSample()
            basic.pause(getSampleInterval())
        }
    }

    export function smoothSample() {
        if (sampleArray.length < smoothingCoefficient) {
            smoothingCoefficient = sampleArray.length
        }
        let temp: number = 0
        for (let i = 0; i < smoothingCoefficient; i++) {
            temp += sampleArray[sampleArray.length - (smoothingCoefficient + 1) - i] * (smoothingCoefficient - i)
        }
        let newSample = Math.round(temp / (smoothingCoefficient * smoothingCoefficient))
        smoothedValues.push(newSample)
        if (newSample > Peak) {
            Peak = newSample
        }
        if (newSample < Trough) {
            Trough = newSample
        }
        let discard: number = smoothedValues.shift()
        if (discard <= Trough) {
            Trough = Math.min(smoothedValues[0], newSample)
        }

        if (discard >= Peak) {
            Peak = Math.max(smoothedValues[0], newSample)
        }
        averageSignal += Math.round((newSample / smoothedValues.length) - (discard / smoothedValues.length))
    }

    //% block="set input pin to $pin"
    //% advanced=true
    //% group='1: Basic Blocks'
    export function setPinNumber(pin: AnalogPin) {
        inputPin = pin
    }


    /**
     * set your target for time spent in high or moderate activity
     * @param value eg: 100
     */
    //% block='set activity target to $value'
    //% blockGap=6
    //% group='1: Basic Blocks'
    export function setActivityTarget(value: number) {
        activityTarget = value
    }

    /**
     * use this to start at a number that is not 0
     * @param value eg: 20
     */
    //% block='set activity points to $value'
    //% group='2: Advanced'
    export function setActivityPoints(value: number) {
        totalActivityPoints = (value * 30)
    }

    /**
    * a measure of sensitivity when looking at the pulse
    */
    //% block="set sensitivity to $value"
    //% advanced=true
    //% value.min=0 value.max=100
    export function setTriggerLevel(value: number) {
        triggerOffset = 50 - value // Future Diana: we should use this.  Current Diana has a weird headache.
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


    /**
     * gets Beats Per Minute, which we calculate as we go along
     */
    //% block="BPM"
    //% advanced=true
    //% blockGap=6
    export function getBPM() {
        return BPM
    }

    //% block="current Smoothed value"
    //% advanced=true
    //% blockGap=6
    export function getSmoothedSample() {
        return smoothedValues[smoothedValues.length - 1]
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
    //% block="take pulse sample"
    //% advanced=true
    //% blockGap=6
    export function readNextSample() {
        // assume that reading is atomic, perfect, complete, and does not get in the way of other things
        sampleArray.push(pins.analogReadPin(inputPin))
        sampleArray.shift()
    }

    function newPulse() {
        IBI = input.runningTime() - lastBeatTime
        lastBeatTime = input.runningTime()
        rate[9] = IBI
        rateTotal += rate[9]
        rateTotal /= 10                                 // this gives us an average, so we avoid spikes
        BPM = Math.round(60000 / rateTotal)             // 60,000ms=60secs
        lastBPMSamples.push(BPM)
        lastBPMSamples.shift()
        resetBeat()
    }

    function resetBeat() {
        Peak = 0
        Trough = 1023
        firstBeat = true
        secondBeat = false
        BPM = 0
    }

    function getLastSample() {
        return smoothedValues[smoothedValues.length - 1]
    }

    function isValidBeatTime(): boolean {
        if (lastBeatTime + 250 < input.runningTime()) {  // If your heart is beating more than 4 times a second, you have a different problem
            return true
        }
        return false
    }


    /**
     * finds if we are in a pulse already, or have just started one
     */
    //% block="process latest sample"
    //% blockGap=8
    //% group='2: Advanced'
    export function processLatestSample() {

        smoothSample()  // now we work on smoothedValues instead of the noisy samples

        // checks if the peak in a new sample is really the start of a beat
        if (smoothedValues[smoothedValues.length - 1] > (smoothedValues[smoothedValues.length - 2]) && (getSmoothedSample() > getTriggerLevel())) {
            // we are rising.
            rising = true
        }

        else if (rising == true && isValidBeatTime() && (getSmoothedSample() < getTriggerLevel()) && smoothedValues[smoothedValues.length - 1] < smoothedValues[smoothedValues.length - 2]) {
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
        if (lastBeatTime - input.runningTime() > 2000) {
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

    //% group='1: Basic Blocks'
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
            tempVar = screenValue
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
