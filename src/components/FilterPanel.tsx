import { useMemo, type ReactNode } from 'react';
import type { CardKind, Catalog, RarityTier, StarStyle } from '../data/types';
import { STAR_STYLES, TIERS } from '../data/rarity';
import {
  BUILTIN_PRESETS,
  EMPTY_FILTERS,
  OWN_LABELS,
  activeFilterCount,
  withPreset,
  type Facets,
  type Filters,
  type OwnFilter,
  type PokeFilter,
  type SortKey,
} from '../state/filters';
import { store, type SavedPreset } from '../state/store';
import { TierIcon } from './TierIcon';
import { Icon } from './Icon';

interface Props {
  catalog: Catalog;
  filters: Filters;
  setFilters: (f: Filters) => void;
  facets: Facets;
  counts: Record<string, number>;
  keep: number;
  presets: SavedPreset[];
  tagOf: (code: string) => string;
}

const toggle = <T,>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

const ELEMENT_LABELS: Record<string, string> = {
  grass: 'Grass',
  fire: 'Fire',
  water: 'Water',
  lightning: 'Lightning',
  psychic: 'Psychic',
  fighting: 'Fighting',
  darkness: 'Darkness',
  metal: 'Metal',
  dragon: 'Dragon',
  fairy: 'Fairy',
  colorless: 'Colorless',
};

const KIND_LABELS: [CardKind, string][] = [
  ['pokemon', 'Pokémon'],
  ['supporter', 'Supporter'],
  ['item', 'Item'],
  ['tool', 'Tool'],
  ['stadium', 'Stadium'],
  ['fossil', 'Fossil'],
];

const POKE_LABELS: [PokeFilter, string][] = [
  ['ex', 'ex'],
  ['mega', 'Mega'],
  ['non-ex', 'Not ex'],
  ['basic', 'Basic'],
  ['stage1', 'Stage 1'],
  ['stage2', 'Stage 2'],
];

const SORTS: [SortKey, string][] = [
  ['set', 'Newest set first'],
  ['name', 'Name A–Z'],
  ['count', 'Most copies'],
  ['spares', 'Most for trade'],
  ['rarity', 'Rarest first'],
];

const SERIES_LABELS: Record<string, string> = { C: 'C series', B: 'B series', A: 'A series', Special: 'Special packs' };

function Section({ title, children, extra }: { title: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <section className="f-section">
      <div className="f-title">
        <h4>{title}</h4>
        {extra}
      </div>
      {children}
    </section>
  );
}

function Count({ n }: { n: number | undefined }) {
  return <span className="chip-count">{n ?? 0}</span>;
}

function sameFilters(a: Filters, b: Filters): boolean {
  const strip = (f: Filters) => JSON.stringify({ ...f, sort: '', group: true, q: '' });
  return strip(a) === strip(b);
}

export function FilterPanel({ catalog, filters: f, setFilters, facets, counts, keep, presets, tagOf }: Props) {
  const set = (patch: Partial<Filters>) => setFilters({ ...f, ...patch });

  // Completion per set for the rarities currently picked (ignores other filters).
  const completion = useMemo(() => {
    const m = new Map<string, { owned: number; total: number }>();
    for (const c of catalog.cards) {
      if (c.reprint) continue;
      if (f.tiers.length && !f.tiers.includes(c.tier)) continue;
      const e = m.get(c.set) ?? { owned: 0, total: 0 };
      e.total += 1;
      if ((counts[c.key] ?? 0) > 0) e.owned += 1;
      m.set(c.set, e);
    }
    return m;
  }, [catalog, f.tiers, counts]);

  const seriesGroups = useMemo(() => {
    const out = new Map<string, typeof catalog.sets>();
    for (const s of catalog.sets) {
      const key = s.isPromo ? 'Promo' : s.series;
      out.set(key, [...(out.get(key) ?? []), s]);
    }
    return [...out.entries()];
  }, [catalog]);

  const packOptions = useMemo(() => {
    const sets = f.sets.length ? f.sets.map((c) => catalog.setByCode.get(c)).filter(Boolean) : [];
    return sets.flatMap((s) => (s!.packs.length > 1 && !s!.isPromo ? s!.packs.map((p) => ({ set: s!, pack: p })) : []));
  }, [catalog, f.sets]);

  const usedTiers = TIERS.filter((t) => t.tier !== 'other' || (facets.tiers.get('other') ?? 0) > 0);
  const nActive = activeFilterCount(f);

  return (
    <div className="filter-panel">
      <Section
        title="Quick lists"
        extra={
          <button
            className="link-btn"
            onClick={() => {
              const name = window.prompt('Name this filter so you can reuse it:');
              if (name?.trim()) store.savePreset(name.trim(), f);
            }}
          >
            <Icon name="bookmark" size={14} /> Save current
          </button>
        }
      >
        <div className="chips">
          {BUILTIN_PRESETS.map((p) => {
            const pf = withPreset(p);
            return (
              <button
                key={p.id}
                className={`chip ${sameFilters(pf, f) ? 'on' : ''}`}
                onClick={() => setFilters({ ...pf, sort: f.sort, group: f.group })}
              >
                {p.name}
              </button>
            );
          })}
          {presets.map((p) => (
            <span key={p.id} className={`chip chip-user ${sameFilters(p.filters, f) ? 'on' : ''}`}>
              <button onClick={() => setFilters({ ...EMPTY_FILTERS, ...p.filters })}>{p.name}</button>
              <button
                className="chip-x"
                aria-label={`Delete ${p.name}`}
                onClick={() => window.confirm(`Delete the saved filter "${p.name}"?`) && store.deletePreset(p.id)}
              >
                <Icon name="close" size={12} />
              </button>
            </span>
          ))}
        </div>
      </Section>

      <Section title="My collection">
        <div className="chips">
          {(Object.keys(OWN_LABELS) as OwnFilter[]).map((o) => (
            <button key={o} className={`chip ${f.own === o ? 'on' : ''}`} onClick={() => set({ own: o })}>
              {o === 'need' ? `Fewer than ${keep}` : o === 'extra' ? `More than ${keep}` : OWN_LABELS[o]}
              <Count n={facets.own.get(o)} />
            </button>
          ))}
        </div>
      </Section>

      <Section
        title="Rarity"
        extra={
          (f.tiers.length > 0 || (f.styles?.length ?? 0) > 0) && (
            <button className="link-btn" onClick={() => set({ tiers: [], styles: [] })}>
              Any
            </button>
          )
        }
      >
        <div className="chips">
          {usedTiers.map((t) => (
            <button
              key={t.tier}
              className={`chip chip-tier ${f.tiers.includes(t.tier) ? 'on' : ''}`}
              onClick={() => set({ tiers: toggle<RarityTier>(f.tiers, t.tier) })}
              aria-pressed={f.tiers.includes(t.tier)}
            >
              <TierIcon tier={t.tier} />
              <Count n={facets.tiers.get(t.tier)} />
            </button>
          ))}
        </div>
        {(facets.tiers.get('s2') ?? 0) > 0 && (
          <div className="sub-filter">
            <span className="sub-label">
              <TierIcon tier="s2" /> kinds
            </span>
            <div className="chips">
              {STAR_STYLES.map((st) => (
                <button
                  key={st.style}
                  className={`chip ${(f.styles ?? []).includes(st.style) ? 'on' : ''}`}
                  onClick={() => set({ styles: toggle<StarStyle>(f.styles ?? [], st.style) })}
                  title={st.hint}
                  aria-pressed={(f.styles ?? []).includes(st.style)}
                >
                  {st.label}
                  <Count n={facets.styles.get(st.style)} />
                </button>
              ))}
            </div>
          </div>
        )}
        <label className="check">
          <input type="checkbox" checked={f.tradeableOnly} onChange={(e) => set({ tradeableOnly: e.target.checked })} />
          Only rarities you can trade
        </label>
      </Section>

      <Section
        title="Expansion"
        extra={
          f.sets.length > 0 && (
            <button className="link-btn" onClick={() => set({ sets: [], packs: [] })}>
              All sets
            </button>
          )
        }
      >
        {seriesGroups.map(([series, sets]) => (
          <div key={series} className="series">
            <button
              className="series-title"
              onClick={() => {
                const codes = sets.map((s) => s.code);
                const all = codes.every((c) => f.sets.includes(c));
                set({ sets: all ? f.sets.filter((c) => !codes.includes(c)) : [...new Set([...f.sets, ...codes])] });
              }}
            >
              {SERIES_LABELS[series] ?? (series === 'Promo' ? 'Promos' : series)}
            </button>
            {sets.map((s) => {
              const comp = completion.get(s.code);
              const on = f.sets.includes(s.code);
              return (
                <button
                  key={s.code}
                  className={`set-row ${on ? 'on' : ''}`}
                  onClick={() =>
                    set({
                      sets: toggle(f.sets, s.code),
                      packs: on ? f.packs.filter((p) => !p.startsWith(`${s.code}|`)) : f.packs,
                    })
                  }
                  aria-pressed={on}
                >
                  <span className="set-tag">{tagOf(s.code)}</span>
                  <span className="set-name">{s.name}</span>
                  <span className="set-meta">
                    {comp && comp.total > 0 && (
                      <span className="mini-bar" title={`You have ${comp.owned} of ${comp.total}`}>
                        <span style={{ width: `${(comp.owned / comp.total) * 100}%` }} />
                      </span>
                    )}
                    <Count n={facets.sets.get(s.code)} />
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </Section>

      {packOptions.length > 0 && (
        <Section title="Booster pack">
          <div className="chips">
            {packOptions.map(({ set: s, pack }) => {
              const id = `${s.code}|${pack}`;
              return (
                <button key={id} className={`chip ${f.packs.includes(id) ? 'on' : ''}`} onClick={() => set({ packs: toggle(f.packs, id) })}>
                  {pack.replace(new RegExp(`^${s.name} `), '')}
                  <Count n={facets.packs.get(id)} />
                </button>
              );
            })}
          </div>
        </Section>
      )}

      <Section title="Energy type">
        <div className="chips">
          {catalog.elements.map((el) => (
            <button key={el} className={`chip ${f.elements.includes(el) ? 'on' : ''}`} onClick={() => set({ elements: toggle(f.elements, el) })}>
              <span className={`dot el-${el}`} />
              {ELEMENT_LABELS[el] ?? el}
              <Count n={facets.elements.get(el)} />
            </button>
          ))}
        </div>
      </Section>

      <Section title="Card type">
        <div className="chips">
          {KIND_LABELS.map(([k, label]) => (
            <button key={k} className={`chip ${f.types.includes(k) ? 'on' : ''}`} onClick={() => set({ types: toggle(f.types, k) })}>
              {label}
              <Count n={facets.types.get(k)} />
            </button>
          ))}
        </div>
        <div className="chips">
          {POKE_LABELS.map(([k, label]) => (
            <button key={k} className={`chip ${f.poke.includes(k) ? 'on' : ''}`} onClick={() => set({ poke: toggle(f.poke, k) })}>
              {label}
              <Count n={facets.poke.get(k)} />
            </button>
          ))}
        </div>
      </Section>

      <Section title="Sort">
        <select value={f.sort} onChange={(e) => set({ sort: e.target.value as SortKey })}>
          {SORTS.map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        {f.sort === 'set' && (
          <label className="check">
            <input type="checkbox" checked={f.group} onChange={(e) => set({ group: e.target.checked })} />
            Show a header for each set
          </label>
        )}
      </Section>

      {nActive > 0 && (
        <button className="btn btn-block" onClick={() => setFilters({ ...EMPTY_FILTERS, sort: f.sort, group: f.group })}>
          Clear all filters ({nActive})
        </button>
      )}
    </div>
  );
}
