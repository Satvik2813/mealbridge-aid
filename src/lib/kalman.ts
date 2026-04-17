/**
 * 1D Kalman Filter Implementation
 * Handles single-dimension tracking with mathematical smoothing via covariance probabilities.
 */
export class KalmanFilter {
  private q: number; // process variance
  private r: number; // measurement variance estimates
  private p: number; // estimate covariance
  private x: number; // state estimate
  private k: number; // Kalman gain

  constructor(r: number = 0.001, q: number = 0.0001, p: number = 1, initial_value: number = 0) {
    this.r = r;
    this.q = q;
    this.p = p;
    this.x = initial_value;
    this.k = 0;
  }

  public update(measurement: number): number {
    // Prediction update
    this.p = this.p + this.q;

    // Measurement update against noise matrix
    this.k = this.p / (this.p + this.r);
    this.x = this.x + this.k * (measurement - this.x);
    this.p = (1 - this.k) * this.p;

    return this.x;
  }
}

/**
 * 2D Kalman Filter wrapping positional GIS coordinates (Latitude and Longitude)
 */
export class GPSKalmanFilter {
  private latFilter: KalmanFilter | null = null;
  private lngFilter: KalmanFilter | null = null;

  // Optimized for magnitude of tight coordinate differences (~0.0000x increments)
  constructor(private r: number = 0.00005, private q: number = 0.000001) {}

  public filter(lat: number, lng: number): { lat: number; lng: number } {
    if (!this.latFilter || !this.lngFilter) {
      this.latFilter = new KalmanFilter(this.r, this.q, 1, lat);
      this.lngFilter = new KalmanFilter(this.r, this.q, 1, lng);
    }
    return {
      lat: this.latFilter.update(lat),
      lng: this.lngFilter.update(lng),
    };
  }
}
