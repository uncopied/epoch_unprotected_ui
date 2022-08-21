export function ellipseAddress(address: string, width = 6): string {
  return `${address.slice(0, width)}...${address.slice(-width)}`;
}

export function formatMoney(value: number): string {
  return value.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

export function formatInteger(value: number, percent: number): number {
  return parseInt(Number(value * percent).toFixed());
}
