import { Money, MAX_MONEY } from './money';
import { DomainError } from './domain-error';

describe('Money', () => {
  it('keeps values beyond Number.MAX_SAFE_INTEGER exact', () => {
    expect(Money.positive('9007199254740993', 'RUB').add(Money.of(1n, 'RUB')).amount).toBe(
      9007199254740994n,
    );
  });

  it.each(['0', '-1', '1.0', '1e3', '01', '', ' 1', '99999999999999999999'])(
    'rejects noncanonical amount %s',
    (value) => {
      expect(() => Money.positive(value, 'USD')).toThrow(DomainError);
    },
  );

  it.each(['usd', 'ZZZ', 'US', 'USDD'])('rejects currency %s', (currency) => {
    expect(() => Money.of(1n, currency)).toThrow(DomainError);
  });

  it('enforces bigint range and positivity', () => {
    expect(Money.of(MAX_MONEY, 'USD').amount).toBe(MAX_MONEY);
    expect(() => Money.of(-1n, 'USD')).toThrow(DomainError);
    expect(() => Money.of(MAX_MONEY + 1n, 'USD')).toThrow(DomainError);
    expect(() => Money.positive('9223372036854775808', 'USD')).toThrow(DomainError);
    expect(() => Money.of(0n, 'USD').assertPositive()).toThrow(DomainError);
    expect(() => Money.of(1n, 'USD').assertPositive()).not.toThrow();
  });

  it('checks arithmetic, funds, overflow and currencies', () => {
    expect(Money.of(9n, 'USD').subtract(Money.of(4n, 'USD')).amount).toBe(5n);
    expect(() => Money.of(1n, 'USD').subtract(Money.of(2n, 'USD'))).toThrow('insufficient');
    expect(() => Money.of(MAX_MONEY, 'USD').add(Money.of(1n, 'USD'))).toThrow('exceeds');
    expect(() => Money.of(1n, 'USD').add(Money.of(1n, 'RUB'))).toThrow('Currencies');
    expect(() => Money.of(1n, 'USD').subtract(Money.of(1n, 'RUB'))).toThrow('Currencies');
  });
});
