
/*
========================================================
 MEDIQUEUE LESOTHO - ARTIFICIAL INTELLIGENCE MODULE
========================================================

 DATASETS:
 1. waiting_queue.csv
 2. medicine_stock.csv

 ALGORITHMS:
 1. Ridge Linear Regression
 2. Logistic Regression

 PURPOSE:
 1. Predict patient waiting times.
 2. Predict medicine stockout risks.

========================================================
*/

// ======================================================
// 1. CSV DATASET READER
// ======================================================

export function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);

  if (lines.length < 2) {
    throw new Error("CSV dataset is empty.");
  }

  const headers = lines[0].split(",").map(h => h.trim());

  return lines.slice(1)
    .filter(line => line.trim())
    .map(line => {
      const values = line.split(",").map(v => v.trim());

      return Object.fromEntries(
        headers.map((header, index) => {
          const value = values[index] ?? "";

          return [
            header,
            value !== "" && !isNaN(Number(value))
              ? Number(value)
              : value
          ];
        })
      );
    });
}


// ======================================================
// 2. RANDOM NUMBER GENERATOR
// ======================================================

function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;

    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);

    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}


// ======================================================
// 3. SPLIT DATASET INTO TRAINING AND TESTING DATA
// ======================================================

export function split(rows, ratio = 0.8, seed = 7) {
  const random = rng(seed);
  const data = [...rows];

  for (let i = data.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));

    [data[i], data[j]] = [data[j], data[i]];
  }

  const n = Math.floor(data.length * ratio);

  return [
    data.slice(0, n),
    data.slice(n)
  ];
}


// ======================================================
// 4. MATRIX SOLVER
// Used by Ridge Linear Regression
// ======================================================

function solve(A, b) {
  const n = b.length;

  const M = A.map((row, i) => [
    ...row,
    b[i]
  ]);

  for (let i = 0; i < n; i++) {
    let pivot = i;

    for (let r = i + 1; r < n; r++) {
      if (
        Math.abs(M[r][i]) >
        Math.abs(M[pivot][i])
      ) {
        pivot = r;
      }
    }

    [M[i], M[pivot]] = [
      M[pivot],
      M[i]
    ];

    if (Math.abs(M[i][i]) < 1e-12) {
      throw new Error(
        "Unable to solve regression matrix. Check your dataset."
      );
    }

    for (let r = i + 1; r < n; r++) {
      const factor = M[r][i] / M[i][i];

      for (let c = i; c <= n; c++) {
        M[r][c] -= factor * M[i][c];
      }
    }
  }

  const x = Array(n).fill(0);

  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n];

    for (let c = i + 1; c < n; c++) {
      sum -= M[i][c] * x[c];
    }

    x[i] = sum / M[i][i];
  }

  return x;
}


// ======================================================
// 5. RIDGE LINEAR REGRESSION
// ======================================================

const dot = (weights, features) =>
  weights.reduce(
    (sum, weight, i) =>
      sum + weight * features[i],
    0
  );

export function fitLinear(X, y, lambda = 1e-3) {
  if (!X.length || X.length !== y.length) {
    throw new Error("Invalid training data.");
  }

  const d = X[0].length;

  const A = Array.from(
    { length: d },
    () => Array(d).fill(0)
  );

  const b = Array(d).fill(0);

  X.forEach((x, k) => {
    for (let i = 0; i < d; i++) {
      b[i] += x[i] * y[k];

      for (let j = 0; j < d; j++) {
        A[i][j] += x[i] * x[j];
      }
    }
  });

  // Ridge regularization
  for (let i = 1; i < d; i++) {
    A[i][i] += lambda;
  }

  return solve(A, b);
}


// ======================================================
// 6. LINEAR REGRESSION PREDICTION
// ======================================================

export const predictLinear = (weights, features) =>
  dot(weights, features);


// ======================================================
// 7. LOGISTIC REGRESSION
// ======================================================

function sigmoid(value) {
  const z = Math.max(-35, Math.min(35, value));

  return 1 / (1 + Math.exp(-z));
}

export function fitLogistic(
  X,
  y,
  epochs = 600,
  learningRate = 0.1
) {
  if (!X.length || X.length !== y.length) {
    throw new Error("Invalid logistic regression data.");
  }

  const d = X[0].length;

  const weights = Array(d).fill(0);

  for (let epoch = 0; epoch < epochs; epoch++) {
    const gradient = Array(d).fill(0);

    X.forEach((x, k) => {
      const probability = sigmoid(
        dot(weights, x)
      );

      for (let i = 0; i < d; i++) {
        gradient[i] +=
          (probability - y[k]) * x[i];
      }
    });

    for (let i = 0; i < d; i++) {
      weights[i] -=
        (learningRate * gradient[i]) / X.length;
    }
  }

  return weights;
}


// ======================================================
// 8. LOGISTIC REGRESSION PREDICTION
// ======================================================

export const predictProb = (weights, features) =>
  sigmoid(dot(weights, features));


// ======================================================
// 9. WAITING QUEUE FEATURES
// ======================================================

const MULT = {
  consult: 1,
  pharmacy: 0.6,
  chronic: 1.4
};

export const waitX = row => {
  const staff = Math.max(1, Number(row.staff));
  const queue = Number(row.queue_ahead);
  const hour = Number(row.hour);

  const ratio = queue / staff;

  return [
    1,
    ratio,
    ratio * (MULT[row.service] ?? 1),
    queue,
    staff,
    hour >= 8 && hour <= 11 ? 1 : 0,
    Number(row.weekend),
    row.facility_type === "hospital" ? 1 : 0
  ];
};


// ======================================================
// 10. MEDICINE STOCK FEATURES
// ======================================================

export const stockX = row => {
  const dailyDispense = Math.max(
    0.01,
    Number(row.daily_dispense)
  );

  const stock = Number(row.stock);

  const cover = Math.min(
    stock / dailyDispense,
    40
  );

  return [
    1,
    3 / (1 + cover),
    Number(row.days_since_restock) / 30,
    dailyDispense / 20,
    cover / 10
  ];
};


// ======================================================
// 11. REGRESSION PERFORMANCE METRICS
// ======================================================

export function regMetrics(y, predictions) {
  const n = y.length;

  if (!n) {
    throw new Error("No testing records available.");
  }

  const mean =
    y.reduce((a, b) => a + b, 0) / n;

  const mae = y.reduce(
    (sum, actual, i) =>
      sum + Math.abs(actual - predictions[i]),
    0
  ) / n;

  const sse = y.reduce(
    (sum, actual, i) =>
      sum + (actual - predictions[i]) ** 2,
    0
  );

  const sst = y.reduce(
    (sum, actual) =>
      sum + (actual - mean) ** 2,
    0
  );

  return {
    mae,
    rmse: Math.sqrt(sse / n),
    r2: sst === 0 ? null : 1 - sse / sst
  };
}


// ======================================================
// 12. CLASSIFICATION PERFORMANCE METRICS
// ======================================================

export function clsMetrics(y, probabilities, threshold = 0.5) {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;

  y.forEach((actual, i) => {
    const prediction =
      probabilities[i] >= threshold ? 1 : 0;

    if (prediction === 1 && actual === 1) tp++;
    else if (prediction === 1) fp++;
    else if (actual === 1) fn++;
    else tn++;
  });

  return {
    tp,
    fp,
    tn,
    fn,
    acc: (tp + tn) / y.length,
    precision: tp / (tp + fp || 1),
    recall: tp / (tp + fn || 1)
  };
}


// ======================================================
// 13. LEARNING CURVE
// ======================================================

export const curve = (
  train,
  test,
  fit,
  score
) =>
  [0.05, 0.1, 0.2, 0.4, 0.6, 0.8, 1].map(f => {
    const subset = train.slice(
      0,
      Math.max(10, Math.floor(train.length * f))
    );

    const model = fit(subset);

    return {
      n: subset.length,
      train: +score(model, subset).toFixed(3),
      test: +score(model, test).toFixed(3)
    };
  });


// ======================================================
// 14. DATASET LOADER
// ======================================================

async function loadDataset(path) {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(
      `Could not load dataset: ${path}`
    );
  }

  const text = await response.text();

  return parseCSV(text);
}


// ======================================================
// 15. WAITING QUEUE DATASET - MODEL TRAINING
// ======================================================

export async function trainWaitingQueue() {

  // CALL WAITING QUEUE CSV DATASET
  const rows = await loadDataset(
    "/datasets/waiting_queue.csv"
  );

  if (rows.length < 2) {
    throw new Error("Waiting Queue dataset has too few records.");
  }

  const [train, test] = split(rows, 0.8, 7);

  const model = fitLinear(
    train.map(waitX),
    train.map(row => Number(row.wait_min))
  );

  const predictions = test.map(row =>
    predictLinear(model, waitX(row))
  );

  return {
    name: "Waiting Queue Prediction",
    algorithm: "Ridge Linear Regression",

    totalRecords: rows.length,
    trainingRecords: train.length,
    testingRecords: test.length,

    model,

    metrics: regMetrics(
      test.map(row => Number(row.wait_min)),
      predictions
    )
  };
}


// ======================================================
// 16. MEDICINE STOCK DATASET - MODEL TRAINING
// ======================================================

export async function trainMedicineStock() {

  // CALL MEDICINE STOCK CSV DATASET
  const rows = await loadDataset(
    "/datasets/medicine_stock.csv"
  );

  if (rows.length < 2) {
    throw new Error("Medicine Stock dataset has too few records.");
  }

  const [train, test] = split(rows, 0.8, 7);

  const model = fitLogistic(
    train.map(stockX),
    train.map(row => Number(row.stockout_7d))
  );

  const probabilities = test.map(row =>
    predictProb(model, stockX(row))
  );

  return {
    name: "Medicine Stock Prediction",
    algorithm: "Logistic Regression",

    totalRecords: rows.length,
    trainingRecords: train.length,
    testingRecords: test.length,

    model,

    metrics: clsMetrics(
      test.map(row => Number(row.stockout_7d)),
      probabilities
    )
  };
}


// ======================================================
// 17. PREDICT A NEW PATIENT'S WAITING TIME
// ======================================================

export function predictPatientWaitingTime(model, patient) {

  const features = waitX(patient);

  const prediction = predictLinear(
    model,
    features
  );

  return {
    estimatedWaitMinutes: Math.max(
      0,
      Math.round(prediction)
    )
  };
}


// ======================================================
// 18. PREDICT MEDICINE STOCKOUT RISK
// ======================================================

export function predictMedicineStockRisk(model, medicine) {

  const probability = predictProb(
    model,
    stockX(medicine)
  );

  return {
    stockoutProbability: probability,
    riskPercentage: Math.round(probability * 100),

    riskLevel:
      probability >= 0.7
        ? "High"
        : probability >= 0.4
          ? "Medium"
          : "Low"
  };
}


// ======================================================
// END OF MEDIQUEUE AI MODULE
// ======================================================
