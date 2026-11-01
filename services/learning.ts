export function learningAndMasterConvertion(masterArray: number[][], curruntArray: number[][], feedback: number = 5): number[][] {
    //update master array and return;

    //loop perpixel and perPixel call compare;

    let mArray: number[][] = [];

    for (let y = 0; y < masterArray.length; y++) {
        mArray[y] = []
        for (let x = 0; x < masterArray[y].length; x++) {
            mArray[y][x] = compareAndReturnForPixel(masterArray[y][x], curruntArray[y][x], feedback)
        }
    }

    console.log("new master array", mArray);

    return mArray;
}

function compareAndReturnForPixel(pixM: number, pixA: number, feedback: number): number {
    let levels = {
        "good": 7,
        "avrage": 5,
        "bad": 3
    }
    
    let tempM = 5;
    if (feedback > 5) { //good +2
        if (pixA) {
            if (pixM < 9) {
                tempM = pixM + 1;
            }
        } else {
            if (pixM > 2) {
                tempM = pixM - 1;
            }
        }
    } else if (feedback < 5) { //bad -2
        if (pixA) {
            if (pixM > 2) {
                tempM = pixM - 1;
            }
        } else {
            if (pixM < 9) {
                tempM = pixM + 1;
            }
        }
    } else {    //avg 5
        tempM = pixM;
    }
    // feedback //9 , 5 , 2   

    return tempM; //learn value 9, 7, 5, 3 , 2
}