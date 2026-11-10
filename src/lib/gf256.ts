const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);

let value = 1;
for (let index = 0; index < 255; index += 1) {
  EXP[index] = value;
  LOG[value] = index;
  value <<= 1;
  if (value & 0x100) {
    value ^= 0x11d;
  }
}
for (let index = 255; index < 512; index += 1) {
  EXP[index] = EXP[index - 255];
}

export function gfMul(left: number, right: number): number {
  if (left === 0 || right === 0) {
    return 0;
  }
  return EXP[LOG[left] + LOG[right]];
}

export function gfInv(valueToInvert: number): number {
  if (valueToInvert === 0) {
    throw new Error("Cannot invert zero in GF(256).");
  }
  return EXP[255 - LOG[valueToInvert]];
}

export function gfDiv(numerator: number, denominator: number): number {
  if (denominator === 0) {
    throw new Error("Cannot divide by zero in GF(256).");
  }
  if (numerator === 0) {
    return 0;
  }
  return EXP[(LOG[numerator] + 255 - LOG[denominator]) % 255];
}

export function gfPow(base: number, exponent: number): number {
  if (exponent === 0) {
    return 1;
  }
  if (base === 0) {
    return 0;
  }
  return EXP[(LOG[base] * exponent) % 255];
}

export function gfMatrixInverse(matrix: number[][]): number[][] {
  const size = matrix.length;
  if (size === 0 || matrix.some((row) => row.length !== size)) {
    throw new Error("GF(256) matrix must be square.");
  }
  const augmented = matrix.map((row, rowIndex) => [
    ...row,
    ...Array.from({ length: size }, (_, columnIndex) =>
      rowIndex === columnIndex ? 1 : 0,
    ),
  ]);

  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    while (pivot < size && augmented[pivot][column] === 0) {
      pivot += 1;
    }
    if (pivot === size) {
      throw new Error("GF(256) matrix is singular.");
    }
    if (pivot !== column) {
      [augmented[pivot], augmented[column]] = [
        augmented[column],
        augmented[pivot],
      ];
    }
    const scale = gfInv(augmented[column][column]);
    for (let entry = 0; entry < size * 2; entry += 1) {
      augmented[column][entry] = gfMul(augmented[column][entry], scale);
    }
    for (let row = 0; row < size; row += 1) {
      if (row === column) {
        continue;
      }
      const factor = augmented[row][column];
      if (factor === 0) {
        continue;
      }
      for (let entry = 0; entry < size * 2; entry += 1) {
        augmented[row][entry] ^= gfMul(factor, augmented[column][entry]);
      }
    }
  }

  return augmented.map((row) => row.slice(size));
}
