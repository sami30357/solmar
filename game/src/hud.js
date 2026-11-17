// Solmar — DOM overlays: title screen, pause menu, mission briefing,
// BUSTED / WASTED cards and the story-complete card. The canvas draws the
// game; these divs are the menus on top of it.

export function createHud(callbacks) {
  const overlay = document.getElementById("overlay");
  const card = document.getElementById("card");

  function show(html) {
    card.innerHTML = html;
    overlay.classList.remove("hidden");
  }

  function hide() {
    overlay.classList.add("hidden");
    card.innerHTML = "";
  }

  function button(id, label) {
    return '<button class="btn" id="' + id + '">' + label + "</button>";
  }

  function showTitle(hasSave) {
    show(
      '<h1 class="logo">SOLMAR</h1>' +
        '<p class="tag">A sun-soaked open-world crime game</p>' +
        '<p class="story">Mara Voss is back in Solmar after five years away — broke, wanted by ' +
        "old friends and older enemies, and one good crew short of the score that " +
        "sets her free. Drive, steal, run fares, dodge the Solmar PD, and work " +
        "Rico's jobs from the bar to the big score.</p>" +
        '<div class="controls">' +
        "<p><b>WASD</b> move / drive &nbsp; <b>Mouse</b> aim &nbsp; <b>Click</b> shoot</p>" +
        "<p><b>E</b> enter / steal car &nbsp; <b>F</b> punch &nbsp; <b>T</b> pick up fare</p>" +
        "<p><b>R</b> radio &nbsp; <b>Shift</b> sprint &nbsp; <b>P</b> pause</p>" +
        "</div>" +
        (hasSave ? button("btn-continue", "Continue") : "") +
        button("btn-new", hasSave ? "New game" : "Start") +
        '<p class="fine">An original game. No real city, no real people.</p>'
    );
    document.getElementById("btn-new").addEventListener("click", () => callbacks.onNewGame());
    const cont = document.getElementById("btn-continue");
    if (cont) cont.addEventListener("click", () => callbacks.onContinue());
  }

  function showBriefing(mission, isFirst) {
    show(
      '<p class="kicker">' + (isFirst ? "Mission 1" : "Next mission") + "</p>" +
        '<h2 class="title2">' + mission.name + "</h2>" +
        '<p class="story">' + mission.text + "</p>" +
        '<p class="objective">Objective: <b>' + mission.objective + "</b></p>" +
        '<p class="reward">Reward: <b>$' + mission.reward + "</b></p>" +
        button("btn-go", "Let's go")
    );
    document.getElementById("btn-go").addEventListener("click", () => callbacks.onBriefingDone());
  }

  function showPause() {
    show(
      '<h2 class="title2">Paused</h2>' +
        '<p class="story">Solmar waits for no one — except right now.</p>' +
        button("btn-resume", "Resume") +
        button("btn-quit", "Quit to title")
    );
    document.getElementById("btn-resume").addEventListener("click", () => callbacks.onResume());
    document.getElementById("btn-quit").addEventListener("click", () => callbacks.onQuitToTitle());
  }

  function showBusted(fine) {
    show(
      '<h2 class="title2 busted">BUSTED</h2>' +
        '<p class="story">The Solmar PD caught up with Mara. Bail and fines: <b>$' + fine + "</b>.</p>" +
        button("btn-back", "Back on the streets")
    );
    document.getElementById("btn-back").addEventListener("click", () => callbacks.onAfterArrest());
  }

  function showWasted(fine) {
    show(
      '<h2 class="title2 busted">WASTED</h2>' +
        '<p class="story">Mara woke up in Solmar General, lighter by <b>$' + fine + "</b> in hospital bills.</p>" +
        button("btn-back", "Back on the streets")
    );
    document.getElementById("btn-back").addEventListener("click", () => callbacks.onAfterArrest());
  }

  function showComplete(cash) {
    show(
      '<h2 class="title2">THE BIG SCORE</h2>' +
        '<p class="story">The Comet GT is gone, the crew is paid, and Mara Voss owns Solmar tonight. ' +
        "Story complete — the city is still yours to roam.</p>" +
        '<p class="reward">Cash: <b>$' + cash + "</b></p>" +
        button("btn-roam", "Keep roaming") +
        button("btn-replay", "Play the story again")
    );
    document.getElementById("btn-roam").addEventListener("click", () => callbacks.onRoam());
    document.getElementById("btn-replay").addEventListener("click", () => callbacks.onNewGame());
  }

  return { showTitle, showBriefing, showPause, showBusted, showWasted, showComplete, hide };
}
