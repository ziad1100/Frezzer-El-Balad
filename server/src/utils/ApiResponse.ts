export class ApiResponse<T = unknown> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;

  constructor(statusCode: number, data: T, message = 'Success') {
    this.success = true;
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
  }
}
