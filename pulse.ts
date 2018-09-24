
/**
 * This code is created for the Pulse Sensor Amped open platform and based on the code they kindly made available
 */

/**
 * Custom blocks
 */
//% weight=60 color=#444A84 icon="\uf051" block="DOT Pulse"
namespace amped {

    let sampleIntervalMS = 10

    let rate: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

    let inputPin: AnalogPin = AnalogPin.P0
    let QS: boolean = false
    let BPM = 5
    let IBI = 600                                     // InterBeat Interval, ms
    let pulse = false
    let sampleCounter: number = 0
    let lastBeatTime: number = 0
    let Peak: number = 512
    let Trough: number = 512
    let threshSetting: number = 550
    let thresh: number = threshSetting
    let amp = 100 // amplitude is 1/10 of input range.  May alter for 3.3V
    let firstBeat = true  // looking for the first beat
    let secondBeat = false // not yet looking for the second beat in a row
    let signal: number = 0

    //% block="set input pin to $pin"
    export function setPinNumber(pin:AnalogPin) {
        inputPin = pin
    }

    let fadeLevel = 0;     // graphing up to 25, but we're dark

    //% block
    export function getSampleInterval() {
        return sampleIntervalMS
    }

    function mapPinToSample(value: number) {
        return pins.map(value, 500, 1023, 0, 1023)
    }

    //% block="current value"
    export function getLatestSample() {
        return signal
    }

    /**
     * gets Beats Per Minute, which we calculate as we go along
     */
    //% block="BPM"
    export function getBPM() {
        return BPM
    }

    function getIBI() {
        return IBI
    }

    function getPulseAmplitude() {
        return amp
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
        //signal = mapPinToSample(pins.analogReadPin(inputPin))
        signal = pins.analogReadPin(inputPin)
    }

    function getSampleCounter() {
        return sampleCounter
    }

    /**
     * finds if we are in a pulse already, or have just started one
     */
    //% block="process current value"
    export function processLatestSample() {
        sampleCounter += sampleIntervalMS
        let N = sampleCounter - lastBeatTime          // N is a time interval

        // here we can fade the graph in/out if we want.

        // find the peak/trough of the pulse wave.
        if (signal < thresh && N > (IBI / 5) * 3) {      // avoid double beats by waiting 3/5 of time since last
            if (signal < Trough) {
                Trough = signal                             // finding the bottom of the trough
            }
        }
        if (signal > thresh && signal > Peak) {
            Peak = signal                                 // keep track of the highest point in the wave
        }

        if (N > 250) {
            if ((signal > thresh) && (pulse == false) && (N > (IBI / 5) * 3)) {
                pulse = true
                IBI = sampleCounter - lastBeatTime
                lastBeatTime = sampleCounter

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

                let runningTotal: number = 0
                for (let i = 0; i < 9; i++) {
                    rate[i] = rate[i + 1]               // we could do this with shift, but we'd still have to do the next line...
                    runningTotal += rate[i]
                }

                rate[9] = IBI
                runningTotal += rate[9]
                runningTotal /= 10                      // this gives us an average, so we avoid spikes
                BPM = Math.round(60000 / runningTotal)             // 60,000ms = 60secs
                QS = true                               // Quantified Self (detected a beat!)

                // if we were going to use LEDs we could graph them here
            }
        }

        if (signal < thresh && pulse == true) {  // values are going down, so the beat is over
            pulse = false
            amp = Peak - Trough
            thresh = (amp / 2) + Trough           // this gives us a better idea of amplitude - how big the pulsebeat is
            Peak = thresh
            Trough = thresh
        }
        if (N > 2500) {                             // 2.5 seconds without a beat means we need to reset
            thresh = threshSetting
            Peak = 512
            Trough = 512
            lastBeatTime = sampleCounter
            firstBeat = true                        // look once more for the first beat
            secondBeat = false
            QS = false
            BPM = 0
            IBI = 600
            pulse = false
            amp = 100
        }
    }
}
