export function buildMinibusDetailHeadings(lineName: string) {
  return {
    route: `${lineName} Minibüs Güzergahı`,
    schedule: `${lineName} Minibüs Saatleri`,
    stops: `${lineName} Minibüs Durakları`,
    fare: `${lineName} Minibüs Ne Kadar`,
  };
}
