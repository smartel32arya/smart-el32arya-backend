export class AppError extends Error {
  constructor(
    public readonly httpStatus: number,
    message: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}
