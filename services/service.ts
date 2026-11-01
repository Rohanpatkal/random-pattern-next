import { genarateArray } from "./array"
import { learningAndMasterConvertion } from "./learning"

export function genarateRandome(value: number): number | undefined {
    if (value == 2) {
        return Math.round(Math.random());
    } else if (value == 10) {
        return Math.floor(Math.random() * 10) + 1;
    }
}

export function genarateRandome2DArray(hight: number, width: number): number[][] {
    let a: number[][] = [];
    for (let i = 0; i < hight; i++) {
        a[i] = [];
        for (let j = 0; j < width; j++) {
            a[i][j] = genarateRandome(10) ?? 0;
        }
    }
    return a;
}

export function convertIntoMasterArray(hight: number, width: number, curruntArray: number[][], feedback: number): number[][] {
    let masterArray: number[][] | null = null;
    try {
        masterArray = JSON.parse(window.localStorage.getItem("masterArray") ?? "null");
    } catch (e) { masterArray = null; }

    if (!masterArray) {
        console.log("array not found in local");
        masterArray = genarateRandome2DArray(hight, width)
        window.localStorage.setItem("masterArray", JSON.stringify(masterArray))
    }

    // console.log("aaaaaaaaaaaaaaaaaaaaaaaa", masterArray);
    if (curruntArray && curruntArray.length === masterArray.length) {
        masterArray = learningAndMasterConvertion(masterArray, curruntArray, feedback);
        window.localStorage.setItem("masterArray", JSON.stringify(masterArray))
    }

    console.log("bbbbbbbbbbbbbbbbbbbbbbbbb", masterArray);

    let array = genarateArray(masterArray, genarateRandome);

    return array;
}