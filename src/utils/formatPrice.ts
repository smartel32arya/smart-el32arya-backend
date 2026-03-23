const arabicDigits = '٠١٢٣٤٥٦٧٨٩'

function toArabicDigits(str: string): string {
  return str.replace(/\d/g, d => arabicDigits[parseInt(d)])
}

export function formatPrice(price: number): string {
  const formatted = price.toLocaleString('en-US')
  return toArabicDigits(formatted) + ' ج.م'
}
