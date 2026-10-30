import InfoTip from "./InfoTip";

/** One short sentence on the page; the rest of the explanation waits behind the «i». */
export default function Desc({ short, more }: { short: string; more?: string }) {
  return (
    <p className="desc">
      {short}
      {more ? <> <InfoTip text={more} /></> : null}
    </p>
  );
}
