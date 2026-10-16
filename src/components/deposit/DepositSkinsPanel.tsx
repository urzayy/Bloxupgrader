import { useMemo, useState } from 'react';
import { MIN_DEPOSIT_TOTAL, validateDepositTotal } from '../../lib/deposit';
import {
  calcDepositCreditTotal,
  validateDepositBonusCode,
  type AppliedDepositBonus,
} from '../../lib/depositBonusCode';
import { SkinCatalogCart, type CatalogCartItem } from '../shop/SkinCatalogCart';
import { DepositBonusCodeField } from './DepositBonusCodeField';
import type { WithdrawTicketBundle } from '../../lib/withdrawChat';

export type DepositItem = CatalogCartItem;

interface Props {
  onRequestDeposit: (items: DepositItem[], bonus?: AppliedDepositBonus) => Promise<WithdrawTicketBundle | null>;
  onSuccess?: () => void;
  className?: string;
}

export function DepositSkinsPanel({ onRequestDeposit, onSuccess, className = '' }: Props) {
  const [error, setError] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');
  const [appliedBonus, setAppliedBonus] = useState<AppliedDepositBonus | null>(null);
  const [cartTotal, setCartTotal] = useState(0);

  const checkoutTotal = useMemo(
    () => (appliedBonus
      ? calcDepositCreditTotal(cartTotal, appliedBonus.percent)
      : cartTotal),
    [appliedBonus, cartTotal],
  );

  const handleApplyCode = async () => {
    setCodeError('');
    if (!codeInput.trim()) {
      setAppliedBonus(null);
      return;
    }
    const result = await validateDepositBonusCode(codeInput);
    if (!result.valid) {
      setAppliedBonus(null);
      setCodeError(result.error ?? 'Invalid code.');
      return;
    }
    setAppliedBonus({
      code: codeInput.trim().toUpperCase(),
      percent: result.percent,
    });
  };

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${className}`}>
      <div className="shrink-0 px-3 pb-1 pt-2 sm:px-4 sm:pt-2.5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <p className="font-display text-sm font-black uppercase tracking-wide text-white">
            Pay by skins
          </p>
          <p className="text-[11px] text-white/40">
            Min. {MIN_DEPOSIT_TOTAL.toLocaleString('en-US')} coins
          </p>
        </div>
        {error && (
          <p className="mt-1.5 rounded-lg border border-risk/25 bg-risk/10 px-3 py-1.5 text-[10px] text-risk">
            {error}
          </p>
        )}
      </div>

      <SkinCatalogCart
        className="min-h-0 flex-1"
        paginated={false}
        priceSort="desc"
        maxItemQuantity={999}
        minSubmitTotal={MIN_DEPOSIT_TOTAL}
        checkoutTotal={checkoutTotal}
        submitIcon="chat"
        submitLabel="Deposit"
        emptyError="Select at least one skin to deposit."
        toolbarExtra={(
          <DepositBonusCodeField
            code={codeInput}
            applied={Boolean(appliedBonus)}
            bonusPercent={appliedBonus?.percent ?? 0}
            error={codeError}
            onCodeChange={value => {
              setCodeInput(value);
              setCodeError('');
            }}
            onApply={() => { void handleApplyCode(); }}
            onClear={() => {
              setAppliedBonus(null);
              setCodeInput('');
              setCodeError('');
            }}
          />
        )}
        onCartTotalChange={setCartTotal}
        validateSubmit={(_, total) => validateDepositTotal(total)}
        onSubmit={async items => {
          setError('');
          const total = items.reduce((sum, item) => sum + item.skin.price * item.quantity, 0);
          const validation = validateDepositTotal(total);
          if (!validation.ok) {
            setError(validation.error ?? 'Invalid deposit.');
            return false;
          }
          if (appliedBonus) {
            const recheck = await validateDepositBonusCode(appliedBonus.code);
            if (!recheck.valid) {
              setAppliedBonus(null);
              setCodeError(recheck.error ?? 'Invalid code.');
              setError('The bonus code is no longer valid.');
              return false;
            }
          }
          try {
            const bundle = await onRequestDeposit(items, appliedBonus ?? undefined);
            if (!bundle?.ticket?.id) {
              setError('Could not create the deposit request. Please try again.');
              return false;
            }
            onSuccess?.();
            return true;
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not create the deposit request. Please try again.');
            return false;
          }
        }}
      />
    </div>
  );
}
