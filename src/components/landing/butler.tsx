import type { Phase } from "./hero-scene";

import styles from "./butler.module.css";

/*
 * The house staff, drawn facing his week: grey at the temples, tails, white
 * gloves, a tray. He waits while you write, takes the errand, and bows.
 * Everything is one silhouette lit from the calendar side, so the only colour
 * on the page is the little there is in him.
 */
export function Butler({ phase }: { phase: Phase }) {
  return (
    <svg
      className={styles.butler}
      data-phase={phase}
      viewBox="0 0 160 240"
      aria-hidden="true"
    >
      <ellipse className={styles.shadow} cx="96" cy="231" rx="52" ry="5" />

      <g className={styles.figure}>
        <g className={styles.body}>
          {/* The far arm, behind everything, with the napkin over it. */}
          <path className={styles.sleeve} d="M122 68L130 110" />
          <path
            className={styles.linen}
            d="M120 96h18a2 2 0 0 1 2 2l-3 26a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3l-2-26a2 2 0 0 1 2-2Z"
          />
          <path className={styles.fold} d="M126 100v26M132 100v26" />

          {/* Tails, hung behind the legs. */}
          <path className={styles.tail} d="M66 108L58 174L82 174L88 118Z" />
          <path className={styles.tail} d="M126 108L134 174L110 174L104 118Z" />

          {/* Trousers and shoes. */}
          <path className={styles.trouser} d="M84 118L79 212L94 212L95 118Z" />
          <path className={styles.trouser} d="M97 118L98 212L113 212L108 118Z" />
          <path className={styles.crease} d="M87 132L84 208M105 132L106 208" />
          <path
            className={styles.shoe}
            d="M79 210L95 210L95 222a4 4 0 0 1-4 4H67a3 3 0 0 1-1-6Z"
          />
          <path
            className={styles.shoe}
            d="M98 210L114 210L118 220a3 3 0 0 1-3 6H102a4 4 0 0 1-4-4Z"
          />
          <path className={styles.toe} d="M70 220h22" />

          {/* Shirt, waistcoat, watch chain. */}
          <path className={styles.linen} d="M96 56L86 66L84 108L108 108L106 66Z" />
          <path className={styles.waistcoat} d="M85 98L107 98L105 124L96 130L87 124Z" />
          <path className={styles.chain} d="M88 106q8 9 15 2" />
          <circle className={styles.stud} cx="88" cy="106" r="1.6" />
          <circle className={styles.stud} cx="103" cy="108" r="1.6" />

          {/* The tailcoat, cut away at the waist. */}
          <path
            className={styles.coat}
            d="M96 52C84 53 74 57 69 66C65 73 63 84 63 98L62 122C70 128 78 126 84 120L88 68Z"
          />
          <path
            className={styles.coat}
            d="M96 52C108 53 118 57 123 66C127 73 129 84 129 98L130 122C122 128 114 126 108 120L104 68Z"
          />
          <path className={styles.lapel} d="M96 53L88 68L84 116L79 115L84 66Z" />
          <path className={styles.lapel} d="M96 53L104 68L108 116L113 115L108 66Z" />
          <path className={styles.rim} d="M69 66C65 73 63 84 63 98L62 122" />

          {/* Collar and tie. */}
          <path className={styles.linen} d="M88 54L96 62L104 54L104 60L96 66L88 60Z" />
          <path className={styles.tie} d="M96 62L84 56L84 69ZM96 62L108 56L108 69Z" />
          <rect className={styles.knot} x="92" y="58" width="8" height="9" rx="2.5" />

          {/* Head. */}
          <path
            className={styles.skin}
            d="M96 11C107 11 114 19 114 31C114 43 107 51 96 51C85 51 78 43 78 31C78 19 85 11 96 11Z"
          />
          <ellipse className={styles.ear} cx="77" cy="33" rx="3.5" ry="5" />
          <ellipse className={styles.ear} cx="115" cy="33" rx="3.5" ry="5" />
          <path
            className={styles.hair}
            d="M78 32C77 17 86 9 96 9C106 9 115 17 114 32C112 25 106 21 96 21C86 21 80 25 78 32Z"
          />
          <path className={styles.sideburn} d="M77 27h4v12h-4zM111 27h4v12h-4z" />
          <path className={styles.brow} d="M85 28q4-2.5 8 0M99 28q4-2.5 8 0" />
          <ellipse className={styles.eye} cx="89" cy="33" rx="1.7" ry="2.2" />
          <ellipse className={styles.eye} cx="103" cy="33" rx="1.7" ry="2.2" />
          <path className={styles.nose} d="M96 34v5" />
          <path
            className={styles.hair}
            d="M96 40c-4-2-9-1-11 2c3 2 7 2 11 1c4 1 8 1 11-1c-2-3-7-4-11-2Z"
          />
          <path className={styles.mouth} d="M92 47q4 2 8 0" />

          {/* The tray arm, out in front, gloved. */}
          <g className={styles.arm}>
            <path className={styles.sleeve} d="M70 66L58 104L34 98" />
            <path className={styles.rim} d="M70 66L58 104" />
            <rect
              className={styles.cuff}
              x="27"
              y="90"
              width="8"
              height="12"
              rx="2"
            />
            <path
              className={styles.glove}
              d="M28 88c-6 0-11 3-11 7c0 4 5 7 11 7c4 0 6-2 6-7c0-5-2-7-6-7Z"
            />
            <path className={styles.fold} d="M20 92q5 3 0 6" />
            <ellipse className={styles.trayShade} cx="16" cy="90" rx="26" ry="6" />
            <ellipse className={styles.tray} cx="16" cy="87" rx="26" ry="6" />
            <rect
              className={styles.parcel}
              x="4"
              y="66"
              width="26"
              height="16"
              rx="4"
            />
          </g>
        </g>
      </g>
    </svg>
  );
}
