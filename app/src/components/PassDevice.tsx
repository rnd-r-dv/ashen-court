// PassDevice (Task 32): the hotseat pass-and-play overlay. Between turns —
// and between the two mulligan phases — the device physically changes hands:
// the Match screen renders this overlay while the outgoing player holds the
// device, and the incoming player taps the big confirm button to take it
// (which also reveals their face-down hand). Pure presentational; Match
// decides when it shows and what confirm does.
import type { PlayerIndex } from '@ashen/core';
import './passdevice.css';

export default function PassDevice({
  player,
  onConfirm,
}: {
  /** The player the device is being passed to (0 → "Player 1"). */
  player: PlayerIndex;
  onConfirm: () => void;
}) {
  return (
    <div className="pass-device">
      <div className="pass-device-inner">
        <h2 className="shell-title">Pass the device to Player {player + 1}</h2>
        <p className="shell-subtitle">
          Player {player + 1}, it&apos;s your move. Your hand stays face-down until you take the
          device.
        </p>
        <button
          type="button"
          className="shell-btn shell-btn-primary pass-device-confirm"
          onClick={onConfirm}
        >
          I&apos;m Player {player + 1} — show my hand
        </button>
      </div>
    </div>
  );
}
