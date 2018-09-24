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
    let QS: boolean = false                             // QS => 'Quantified Self'.  It means we saw a beat.
    let BPM = 5                                         // Beats Per Minute
    let IBI = 600                                       // InterBeat Interval, ms
    let pulse = false
    let sampleCounter: number = 0
    let lastBeatTime: number = 0
    let Peak: number = 512
    let Trough: number = 512
    let threshSetting: number = 550                     // This is a fallback number that we never change
    let thresh: number = threshSetting                  // This number, we do change, but it starts at the fallback position
    let amp:number = 100                                // amplitude is 1/10 of input range.  This might not be right, but that's fine
    let firstBeat: boolean = true                       // Are we currently looking for the first beat?
    let secondBeat: boolean = false                     // We're not yet looking for the second beat in a row, but we will be.
    let signal: number = 0                              // This is what we use to store what we have just measured

    //% block
    export function getSampleInterval() {               // We don't really need to show this to anyone, but it can be useful.
        return sampleIntervalMS
    }

    function mapPinToSample(value: number) {
        return pins.map(value, 500, 1023, 0, 1023)
    }

    //% block="live sample"
    export function getLatestSample() {
        return signal
    }

    //% block
    export function getBPM() {                          // This is one we *do* need to show to anyone who asks.
        return BPM
    }

    function getIBI() {
        return IBI
    }

    function getPulseAmplitude() {
        return amp
    }

    function getLastBeatTime() {                        // We're not interested in the literal time, just how long it has been.
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

    //% block
    export function readNextSample() {                  // The signal should start at about 500, but /might/ not.  The commented line is the other option
        //signal = mapPinToSample(pins.analogReadPin(inputPin))
        signal = pins.analogReadPin(inputPin)
    }

    //% block
    export function getSampleCounter() {
        return sampleCounter
    }

    //% block
    export function processLatestSample() {
        sampleCounter += sampleIntervalMS
        let N = sampleCounter - lastBeatTime            // N is a time interval

        // here we can fade the graph in/out if we want.

        // find the peak/trough of the pulse wave.
        if (signal < thresh && N > (IBI / 5) * 3) {     // avoid double beats by waiting 3/5 of time since last
            if (signal < Trough) {
                Trough = signal                         // finding the bottom of the trough
            }
        }
        if (signal > thresh && signal > Peak) {
            Peak = signal                               // keep track of the highest point in the wave
        }

        if (N > 250) {
            if ((signal > thresh) && (pulse == false) && (N > (IBI / 5) * 3)) {
                pulse = true
                IBI = sampleCounter - lastBeatTime
                lastBeatTime = sampleCounter

                if (secondBeat) {
                    secondBeat = false                  // We are no longer looking for the second beat
                    for (let i = 0; i < 10; i++) {
                        rate[i] = IBI                   // Seed the running total to take a quick stab at the BPM
                    }
                }

                if (firstBeat) {
                    firstBeat = false
                    secondBeat = true
                    // We can't yet use IBI to seed the running total, but we can check again for the second beat
                    return   // bug out for the moment, so we don't accidentally continue downwards
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

            }
        }

        if (signal < thresh && pulse == true) {         // values are going down, so the beat is over
            pulse = false
            amp = Peak - Trough
            thresh = (amp / 2) + Trough                 // this gives us a better idea of amplitude - how big the pulsebeat is
            Peak = thresh
            Trough = thresh
        }
        if (N > 2500) {                                 // 2.5 seconds without a beat means we need to reset
            thresh = threshSetting
            Peak = 512
            Trough = 512
            lastBeatTime = sampleCounter
            firstBeat = true                            // look once more for the first beat
            secondBeat = false
            QS = false
            BPM = 0
            IBI = 600
            pulse = false
            amp = 100
        }
    }



}

/*
*  Below this point are experimental pulse-finders.  They are currently here for interest, and represent other possible ways.
*  They are unlikely to work without some extra love.
*/

// weight=50 color=#442211 icon="" block="DOT Pulse A"
namespace avPulse {
    /**
     * we'll need a running total holder, and then we need to find out if the average is going up or down,
     * and if it has been going up or down recently
     * 
     * three 'up' in a row followed by three 'down' in a row should indicate that we've had a peak.
     * it's already equivalent to an average, so we probably don't need to got with an arbitrary majority
     * 
     * total goes up, we push to our array saying 'up' and total goes down we push to our array saying down.  No change, we push 0.
     * 
     * So we're working with 1, 0, -1.  We're particularly looking for 3 up, and then a flag
     * and then 3 down within 4 ticks, because we might hit a 0.
     * 
     * We could also just set and clear flags for a number over 500, and see if that works.
     * 
     */
    let runningTotal: number = 0
    let runningNumbers: number[] = [0, 0, 0]
    let recentNews: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    let entirelyArbitraryThreshold: number = 750
    let eAT: number = entirelyArbitraryThreshold
    let otherThreshold: number = eAT - 20                  // lower level for hysteresis management
    let pulseCount = 0

    let upwards: boolean = false



    //% block
    export function takeSample(): void {
        runningNumbers.push(pins.analogReadPin(AnalogPin.P0))
    }

    //% block
    export function calculateRunningTotal(): void {
        let currentTotal: number = runningTotal
        runningTotal -= runningNumbers.pop()
        runningTotal += runningNumbers[-1]
        if (runningTotal > currentTotal) {
            recentNews.push(1)
        }
        else if (runningTotal < currentTotal) {
            recentNews.push(-1)
        }
        else { recentNews.push(0) }
        recentNews.shift()
    }
    //% block
    export function checkDirection(): void {
        if (recentNews[0] == 1 && recentNews[1] == 1 && recentNews[2] == 1 && runningTotal >= eAT * 3) {
            // set flag
            upwards = true
        }
        if (recentNews[0] == -1 && recentNews[1] == -1 && recentNews[2] == -1 && runningTotal < (otherThreshold * 3) && upwards == true) {

            // downside of peak.  Unset flag, record beat.  Clear state.
            upwards = false
            pulseCount++
        }
    }

    //% block expose Pulse Count
    export function getPulseCount(): number {
        return pulseCount
    }
}


// weight=50 color=#0fbc11 icon="" block="DOT Pulse B"
namespace dotPulse {

    let sampleRate: number = 10                  // per second
    let values: number[] = []
    let peaks: number[] = []
    let sampleIndex: number = 0
    let currentPeaks: number = 5
    let uncleanPeaks: number = 0
    let interval: number = 1000 / sampleRate        // ms

    /**
     * peak finder; returns but does not clean data
     * includes plateaus as multiple peaks
     * @param array, eg: values
     */
    //% block
    export function findPeaks(): void {
        let array: number[] = values
        for (let i: number = 1; i < array.length - 1; ++i) {
            if (array[(i - 1)] <= array[i] && array[i] >= array[(i + 1)]) {
                peaks[i] = 1
            }
            else { peaks[i] = 0 }
        }
    }

    /**
     * Counts peaks, judging them for validity
     * @param array describe parameter here, eg: peaks
     */
    //% block
    export function countPeaks(): void {
        let array: number[] = peaks
        let count: number = 0
        //reduce small clusters to individual 1s by only counting the last
        for (let i: number = 0; i < sampleRate - 1; i++) {
            if (array[i] == 1 && array[i + 1] == 0) {
                count++
            }
        }
        currentPeaks += count
        //return count
    }

    /** 
     * exposes values
     */
    //% block
    export function returnValues() {
        return values
    }

    /**
     * exposes peaks
     */
    //% block
    export function returnPeaks() {
        return peaks
    }

    /**
     * returns uncleanPeaks
     */
    //% block
    export function returnUncleanPeaks() {
        return uncleanPeaks
    }


    /**
     * returns currentPeaks 
     */
    //% block
    export function getCurrentPeaks(): number {
        return currentPeaks
    }

    /**
     * returns sampleRate
     */
    //% block
    export function getSampleRate(): number {
        return sampleRate
    }

    /**
     * returns interval
     */
    //% block
    export function getInterval(): number {
        return interval
    }

    //% block
    export function takeSample(): void {
        values[sampleIndex] = pins.analogReadPin(AnalogPin.P0)
        serial.writeNumber(values[sampleIndex])
        sampleIndex++
        if (sampleIndex > peaks.length) {
            sampleIndex = 0
        }
    }

    /**
     * samples at 1000 sampleRate ms
     */
    //% block
    export function initiateCounter(): void {
        // Array.fill does not seem to exist here, so we'll fill it as a loop
        for (let i: number = 0; i < sampleRate; i++) {
            peaks.push(0)
            values.push(0)
        }
    }
}
