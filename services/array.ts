export function genarateArray(masterArray: number[][] | null, genarateRandome: (value: number) => number | undefined): number[][] {

    if (!masterArray) return [];
    let a: number[][] = [];

    for (let y = 0; y < masterArray.length; y++) {
        a[y] = [];
        for (let x = 0; x < masterArray[y].length; x++) {
            a[y][x] = masterArray[y][x] >= (genarateRandome(10) ?? 0) ? 1 : 0;
        }
    }

    return a;
}
