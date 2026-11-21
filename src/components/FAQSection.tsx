import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { FAQ_ITEMS } from '../config/infraxConfig';

export function FAQSection() {
  const [openId, setOpenId] = useState<string | null>(FAQ_ITEMS[0]?.id ?? null);

  const toggleItem = (id: string) => {
    setOpenId((current) => (current === id ? null : id));
  };

  return (
    <section id="faq" className="border-t border-white/10 bg-[#050505] py-20 sm:py-28">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#AEDD00]">
              Information
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold uppercase tracking-tight text-white sm:text-4xl text-balance">
              Frequently Asked Questions
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#A0A0A0]">
              Essential answers on participation, registration via Tally, competition guidelines,
              and Short Film public voting.
            </p>
          </div>

          <div className="divide-y divide-white/10 border-t border-b border-white/10 lg:col-span-8">
            {FAQ_ITEMS.map((item) => {
              const isOpen = openId === item.id;
              return (
                <div key={item.id} className="bg-[#050505]">
                  <button
                    type="button"
                    onClick={() => toggleItem(item.id)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${item.id}`}
                    className="flex min-h-[60px] w-full items-center justify-between gap-6 py-5 text-left transition-colors hover:text-[#AEDD00]"
                  >
                    <span
                      className={`font-display text-base font-semibold sm:text-lg ${
                        isOpen ? 'text-[#AEDD00]' : 'text-white'
                      }`}
                    >
                      {item.question}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`flex h-8 w-8 shrink-0 items-center justify-center border transition-colors ${
                        isOpen
                          ? 'border-[#AEDD00] bg-[#AEDD00] text-[#050505]'
                          : 'border-white/15 bg-[#111111] text-white'
                      }`}
                    >
                      {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    </span>
                  </button>

                  {isOpen && (
                    <div
                      id={`faq-panel-${item.id}`}
                      className="pb-6 pr-12 text-sm leading-relaxed text-[#A0A0A0] sm:text-base"
                    >
                      {item.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
