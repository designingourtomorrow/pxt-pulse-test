
/**
 * This code is created for the Pulse Sensor Amped open platform and based on the code they kindly made available
 */

/**
 * Custom blocks
 */
//% weight=60 color=#444A84 icon="\uf051" block="DOT Pulse"
namespace amped {

    let sampleIntervalMS = 20

    let rate: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    let values: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

    let inputPin: AnalogPin = AnalogPin.P0
    let QS: boolean = false
    let BPM = 0
    let IBI = 600                                     // InterBeat Interval, ms
    let pulse = false
    let lastBeatTime: number = input.runningTime()
    let Peak: number = 512
    let Trough: number = 512
    let threshSetting: number = 0
    let thresh: number = threshSetting
    let amp = 90 // amplitude is 1/10 of input range.  May alter for 3.3V
    let firstBeat = true  // looking for the first beat
    let secondBeat = false // not yet looking for the second beat in a row
    let signal: number = 0
    let rising: boolean = false
    let rateTotal: number = 0                           // tracks time taken for IBI
    let runningTotal: number = 0                        // } We use these to track if we are rising or falling
    let lastTotal: number = 0                           // }


    //% block="set input pin to $pin"
    export function setPinNumber(pin: AnalogPin) {
        inputPin = pin
    }

    //% block
    export function getSampleInterval() {
        return sampleIntervalMS
    }

    //% block
    export function setSampleInterval(value: number) {
        sampleIntervalMS = value
    }

    function mapPinToSample(value: number) {
        return pins.map(value, 500, 1023, 0, 1023)
    }

    //% block="current value"
    export function getLatestSample() {   // We're currently sampling from the end for no reason I can really recall...
        return values[values.length - 2]
    }

    /**
     * gets Beats Per Minute, which we calculate as we go along
     */
    //% block="BPM"
    export function getBPM() {
        return BPM
    }

    /**
     * get amplitude of signal (how big from highest to lowest)
     */
    //% block="amp"
    export function getAmp() {
        return amp
    }

    /**
    * show Inter-Beat Interval
    */
    //% block="IBI"
    export function getIBI() {
        return IBI
    }

    function getLastBeatTime() {
        return lastBeatTime
    }

    function sawStart() {
        let started: boolean = QS
        QS = false
        return started
    }

    function isInsideBeat() {
        return pulse
    }

    /**
     * takes a reading from the pin connected to the pulse meter
     */
    //% block="read (and save) value"
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
    //% block="process current value"
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
        // moveThresh(0)                              // We always want to move the threshold after a beat, but probably not brutally
    }
}
