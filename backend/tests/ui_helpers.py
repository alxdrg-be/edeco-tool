"""Behavioural waits shared by browser tests without hard-coded tool counts."""


def wait_for_toolhub(page):
    page.wait_for_function("""() => {
      const hub = document.querySelector('.toolbox[data-toolhub-count]');
      const expected = Number(hub?.getAttribute('data-toolhub-count'));
      return Boolean(hub && expected > 0 && hub.querySelectorAll('.toolbox-card').length === expected);
    }""")
