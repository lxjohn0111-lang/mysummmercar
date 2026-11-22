import * as THREE from 'three';
import { pick, rand, fmtMoney } from '../core/util.js';
import { audio } from '../core/audio.js';
import { LINES } from './npcs.js';

// Keyboard-driven conversations with NPCs (number keys pick an option).
export class Dialog {
  constructor(game) {
    this.game = game;
    this.npc = null;
    this.options = [];
  }
  open(n) {
    const g = this.game;
    this.npc = n;
    const opts = [];
    const chat = { label: 'Chat', fn: () => n.say(pick(LINES[n.id] || ['...'])) };
    const bye = { label: 'Bye', fn: () => {} };
    const A = g.actions;
    switch (n.id) {
      case 'tarja':
        opts.push({ label: 'I\'d like to buy something', fn: () => A.shop('shop') });
        if (!g.jobs.active) opts.push({ label: 'Any work? (newspaper round)', fn: () => { n.say('The paper boy quit again. Deliver these to 8 mailboxes, 22 marks each.'); g.jobs.startPaper(); for (let i = 0; i < 3; i++) A.spawnNear('newspaper', g.spots.shopDrop); } });
        break;
      case 'kaija': opts.push({ label: 'A drink, please', fn: () => A.shop('pub') }); break;
      case 'leena': opts.push({ label: 'Buy something', fn: () => A.shop('kiosk') }); break;
      case 'jussi':
        opts.push({ label: 'Show me your parts', fn: () => A.shop('parts') });
        if (!g.jobs.active) opts.push({ label: 'Got any delivery work for my van?', fn: () => {
          if (g.van.pos.distanceTo(n.pos) > 60) { n.say('Bring your van here and I have crates for you.'); return; }
          n.say('Four crates. Don\'t break them. Pays well.'); g.jobs.startDelivery();
        } });
        break;
      case 'mattila': opts.push({ label: 'Inspect my car', fn: () => A.inspection() }); break;
      case 'seppo': opts.push({ label: 'Workshop services', fn: () => A.mechanic() }); break;
      case 'nieminen': opts.push({ label: 'Police business', fn: () => A.policeDesk() }); break;
      case 'raimo': opts.push({ label: 'Let\'s trade', fn: () => A.junkShop() }); break;
      case 'jari': opts.push({ label: 'About the rally...', fn: () => A.rallyOffice() }); break;
      case 'aune': {
        const day = Math.floor(g.time.minutes / 1440);
        if (!g.jobs.active && g.state.hayDay !== day) opts.push({ label: 'Can I help with the hay?', fn: () => { g.state.hayDay = day; n.say('Oh bless you! The tractor is in the shed. Bring the bales to the barn. 70 marks each!'); g.jobs.startHay(); } });
        const wood = g.items.list.filter((e) => e.defId === 'firewood' && e.mesh.position.distanceTo(n.pos) < 8);
        opts.push({ label: `Sell firewood (${wood.length} pcs nearby, 8 mk each)`, fn: () => {
          if (!wood.length) { n.say('Bring firewood and put it down near me, dear.'); return; }
          for (const e of wood) g.items.remove(e);
          g.earn(wood.length * 8, `Sold ${wood.length} firewood`); n.say('Lovely dry birch. Thank you!');
        } });
        if (g.state.pullaDay !== day) opts.push({ label: 'Coffee and pulla?', fn: () => { g.state.pullaDay = day; const p = g.player.n; p.hunger = Math.max(0, p.hunger - 30); p.thirst = Math.max(0, p.thirst - 15); p.stress = Math.max(0, p.stress - 15); p.fatigue = Math.max(0, p.fatigue - 10); n.say('Eat, eat! You are too thin.'); audio.play('eat'); } });
        break;
      }
      case 'pertti': {
        const held = g.interact.held;
        if (held && (held.defId === 'beer' || held.defId === 'beerCase')) opts.push({ label: 'Give Pertti a beer', fn: () => this.giveBeer(n, held) });
        let v = null; for (const veh of g.vehicles) if (veh.kind !== 'moped' && veh.kind !== 'tractor' && veh.pos.distanceTo(n.pos) < 25 && !veh.locked) v = veh;
        if (v && !g.jobs.active) {
          const hr = (g.time.minutes % 1440) / 60;
          const toPub = hr >= 14 && hr < 23;
          opts.push({ label: toPub ? 'Want a ride to the pub?' : 'Want a ride home?', fn: () => {
            n.say(toPub ? 'To the pub! You are a saint!' : 'Home... yes... home is good. *hic*');
            g.jobs.startTaxi(v, toPub ? 'Baari Kontio' : 'Pertti\'s house', toPub ? g.spots.pubSeats[0] : g.spots.perttiBench);
          } });
        }
        break;
      }
    }
    opts.push(chat, bye);
    this.options = opts.slice(0, 5);
    g.ui.dialog(`${n.name} <small>${n.role}</small>`, pick(LINES[n.id] || ['...']), this.options);
    n.say(pick(LINES[n.id] || ['Moi.']), 3);
  }
  giveBeer(n, item) {
    const g = this.game;
    if (item.defId === 'beerCase') { if (item.count <= 0) return; item.count--; } else g.items.remove(item);
    audio.play('gulp', n.pos);
    g.stats.perttiBeers = (g.stats.perttiBeers || 0) + 1;
    const r = Math.random();
    if (r < 0.35) { const m = Math.round(rand(20, 80)); g.earn(m, 'Pertti paid you back... somehow'); n.say(`Ahh! Here, ${m} marks. Don't ask where I got it.`); }
    else if (r < 0.6) { n.say('Kiitos! Here, I found this in a ditch. Car part I think?'); const ids = ['plug', 'belt', 'oilfilter', 'mirror', 'fuses']; const inst = g.car.createPart(pick(ids), { cond: rand(0.5, 1) }); g.car.spawnLoose(inst, n.pos.clone().add(new THREE.Vector3(0.5, 1, 0.5))); }
    else if (r < 0.8) n.say(pick(['Tip: Rautala police park near the town sign. Watch your speed.', 'Tip: The race carb is great but tune it rich-ish, around 13.', 'Tip: Never forget the oil. I forgot once. Once.', 'Tip: There are old moose antlers in the woods. Collectors pay good money. Probably.']));
    else n.say('*burp* ...You are my best friend. My BEST friend.');
    g.achieve('pertti', 'Best Friends', 'Bought Pertti a beer');
  }
  update() {
    const g = this.game, n = this.npc;
    if (!n) return;
    if (n.pos.distanceTo(g.player.pos) > 4.5 || g.player.inVehicle) { this.close(); return; }
    for (let i = 0; i < this.options.length; i++) {
      if (g.input.hit(`Digit${i + 1}`) || g.input.hit(`Numpad${i + 1}`)) {
        const op = this.options[i]; this.close(); audio.play('ui'); op.fn(); return;
      }
    }
  }
  close() { this.npc = null; this.game.ui.closeDialog(); }
  get open_() { return !!this.npc; }
}
