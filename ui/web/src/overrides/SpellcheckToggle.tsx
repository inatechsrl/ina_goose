/**
 * Web override for SpellcheckToggle.
 *
 * Browsers have built-in spellcheck via the `spellcheck` HTML attribute.
 * There is nothing to configure here — show a brief informational note instead.
 */
export const SpellcheckToggle = () => {
  return (
    <div className="flex items-center justify-between py-2 px-2 rounded-lg">
      <div>
        <h3 className="text-text-primary">Spellcheck</h3>
        <p className="text-xs text-text-secondary max-w-md mt-[2px]">
          Spellcheck is handled by your browser. Configure it in your browser settings.
        </p>
      </div>
    </div>
  );
};
