(function () {
  const initImageCardGridNav = (section = document) => {
    section.querySelectorAll('.cust-image-card-grid--mobile-swipe').forEach((grid) => {
      // Hover-reveal grids run the looping carousel below, which owns their nav.
      if (grid.classList.contains('cust-image-card-grid--hover-reveal')) {
        return;
      }

      if (grid.dataset.navReady === 'true') {
        return;
      }

      const track = grid.querySelector('.cust-image-card-grid__items');
      const prevButton = grid.querySelector('[data-image-card-grid-prev]');
      const nextButton = grid.querySelector('[data-image-card-grid-next]');

      if (!track || !prevButton || !nextButton) {
        return;
      }

      grid.dataset.navReady = 'true';

      const setButtonState = (button, disabled) => {
        button.classList.toggle('is-disabled', disabled);
        button.setAttribute('aria-disabled', disabled ? 'true' : 'false');
        button.disabled = disabled;
      };

      const updateNavState = () => {
        const maxScroll = Math.max(track.scrollWidth - track.clientWidth, 0);
        const scrollLeft = Math.max(track.scrollLeft, 0);
        const boundaryTolerance = Math.min(Math.max(getStep() * 0.35, 32), 80);

        setButtonState(prevButton, scrollLeft <= boundaryTolerance);
        setButtonState(nextButton, scrollLeft >= maxScroll - boundaryTolerance);
      };

      const getStep = () => {
        const firstItem = track.querySelector('.cust-image-card-grid__item');

        if (!firstItem) {
          return track.clientWidth;
        }

        const styles = window.getComputedStyle(track);
        const gap = parseFloat(styles.columnGap || styles.gap || '0') || 0;

        return firstItem.getBoundingClientRect().width + gap;
      };

      const scrollByStep = (direction) => {
        const button = direction < 0 ? prevButton : nextButton;

        if (button.classList.contains('is-disabled')) {
          updateNavState();
          return;
        }

        track.scrollBy({
          left: getStep() * direction,
          behavior: 'smooth'
        });

        window.setTimeout(updateNavState, 450);
      };

      prevButton.addEventListener('click', () => scrollByStep(-1));
      nextButton.addEventListener('click', () => scrollByStep(1));
      track.addEventListener('scroll', updateNavState, { passive: true });
      track.addEventListener('scrollend', updateNavState, { passive: true });
      window.addEventListener('resize', updateNavState, { passive: true });
      requestAnimationFrame(updateNavState);
    });
  };

  // Hover-reveal (VIVAIA) grids: lock the desktop row height to the resting column
  // height so the accordion only changes a card's width, never the row's height.
  const initHoverRevealHeight = (section = document) => {
    // Only the accordion needs a locked row height; the carousel keeps its natural ratio.
    section.querySelectorAll('.cust-image-card-grid--hover-reveal.cust-image-card-grid--desktop-accordion').forEach((grid) => {
      const track = grid.querySelector('.cust-image-card-grid__items');

      if (!track) {
        return;
      }

      const apply = () => {
        // Mobile stacks/swipes with a natural aspect ratio — no fixed height there.
        if (window.matchMedia('(max-width: 767px)').matches) {
          grid.style.removeProperty('--image-card-desktop-height');
          return;
        }

        const count = track.querySelectorAll('.cust-image-card-grid__item:not([data-clone])').length || 1;
        const styles = window.getComputedStyle(track);
        const gap = parseFloat(styles.columnGap || styles.gap || '0') || 0;
        const ratioRaw = window.getComputedStyle(grid).getPropertyValue('--image-card-desktop-ratio');
        const ratio = (parseFloat(ratioRaw) || 86.2) / 100;
        const restWidth = (track.clientWidth - gap * (count - 1)) / count;

        if (restWidth > 0) {
          grid.style.setProperty('--image-card-desktop-height', Math.round(restWidth * ratio) + 'px');
        }
      };

      apply();
      window.addEventListener('resize', apply, { passive: true });
    });
  };

  // A card may hold a landscape cut for desktop and a portrait one for phones.
  // CSS shows one of them; this picks the same one so playback follows the eye.
  const visibleVideo = (item) => {
    const selector = window.matchMedia('(max-width: 767px)').matches
      ? 'video.cust-image-card-grid__video--mobile'
      : 'video.cust-image-card-grid__video--desktop';

    // Falls back to the lone video on cards that only have one cut.
    return item.querySelector(selector) || item.querySelector('video');
  };

  // Card videos are always muted+looped; only *when* they play varies.
  const setCardPlaying = (item, shouldPlay) => {
    const videos = item.querySelectorAll('video');

    if (!videos.length) {
      return;
    }

    const active = shouldPlay ? visibleVideo(item) : null;

    Array.prototype.forEach.call(videos, (video) => {
      if (video === active) {
        if (video.paused) {
          video.muted = true;
          const played = video.play();

          if (played && typeof played.catch === 'function') {
            played.catch(() => {});
          }
        }
        return;
      }

      if (!video.paused) {
        video.pause();
      }

      // A paused video keeps showing its last frame, not its poster — so an
      // off-centre card would drift away from the still that the loop clones use.
      // Rewinding keeps every idle copy of a card on the same first frame.
      if (video.currentTime > 0) {
        try {
          video.currentTime = 0;
        } catch (error) {
          // Seeking before metadata is ready throws; it will start at 0 anyway.
        }
      }
    });
  };

  // Playback modes: "hover" plays while the pointer is over a card (touch devices
  // fall back to the centred card, handled by the carousel); "autoplay" plays
  // whenever the card is on screen.
  const initCardVideos = (section = document) => {
    section.querySelectorAll('.cust-image-card-grid').forEach((grid) => {
      const items = Array.prototype.slice.call(grid.querySelectorAll('.cust-image-card-grid__item'));
      const mode = grid.dataset.videoPlayback || 'hover';

      // "Centre only" is driven entirely by the carousel — nothing to bind here.
      if (mode === 'center') {
        return;
      }

      const autoplay = mode === 'autoplay';

      items.forEach((item) => {
        const video = item.querySelector('video');

        if (!video || item.dataset.videoReady === 'true') {
          return;
        }

        item.dataset.videoReady = 'true';
        video.muted = true;

        if (autoplay) {
          if (!('IntersectionObserver' in window)) {
            setCardPlaying(item, true);
            return;
          }

          const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
              setCardPlaying(item, entry.isIntersecting && entry.intersectionRatio > 0.4);
            });
          }, { threshold: [0, 0.4, 0.75] });

          observer.observe(item);
          return;
        }

        // Hover playback — pointer devices only. While the carousel is moving,
        // cards slide under a stationary cursor and would otherwise fire
        // mouseenter/mouseleave repeatedly, flickering the video on and off.
        if (window.matchMedia('(hover: hover)').matches) {
          item.addEventListener('mouseenter', () => {
            if (!grid.classList.contains('is-scrolling')) {
              setCardPlaying(item, true);
            }
          });
          item.addEventListener('mouseleave', () => setCardPlaying(item, false));
        }
      });
    });
  };

  // Hover-reveal mobile: seamless looping center-peek carousel. The strip is
  // cloned into [clones][originals][clones] so it is perfectly periodic; the
  // card nearest the middle is largest and shrinks toward the edges.
  const initHoverRevealCarousel = (section = document) => {
    section.querySelectorAll('.cust-image-card-grid--hover-reveal').forEach((grid) => {
      const swipeOnMobile = grid.classList.contains('cust-image-card-grid--mobile-swipe');
      const carouselOnDesktop = grid.classList.contains('cust-image-card-grid--desktop-carousel');

      if (!swipeOnMobile && !carouselOnDesktop) {
        return;
      }

      const track = grid.querySelector('.cust-image-card-grid__items');

      if (!track || track.dataset.peekReady === 'true') {
        return;
      }

      const originals = Array.prototype.slice.call(track.querySelectorAll('.cust-image-card-grid__item'));
      const realCount = originals.length;

      if (realCount < 1) {
        return;
      }

      track.dataset.peekReady = 'true';

      const counter = grid.querySelector('[data-image-card-grid-count]');
      const prevBtn = grid.querySelector('[data-image-card-grid-prev]');
      const nextBtn = grid.querySelector('[data-image-card-grid-next]');
      // How far off-centre cards shrink. This drives most of the visible gap
      // between cards, so it is operator-controlled via the section settings.
      const configuredScale = parseFloat(
        window.getComputedStyle(grid).getPropertyValue('--image-card-min-scale')
      );
      const MIN_SCALE = configuredScale > 0 && configuredScale <= 1 ? configuredScale : 0.92;

      const canLoop = grid.dataset.loop !== 'false' && realCount >= 2;

      // Duplicate the set on both sides so scrolling can wrap invisibly.
      if (canLoop) {
        const before = document.createDocumentFragment();
        const after = document.createDocumentFragment();
        originals.forEach((item) => {
          const a = item.cloneNode(true);
          const b = item.cloneNode(true);
          a.setAttribute('data-clone', '1');
          b.setAttribute('data-clone', '1');
          a.removeAttribute('id');
          b.removeAttribute('id');
          before.appendChild(a);
          after.appendChild(b);
        });
        track.insertBefore(before, originals[0]);
        track.appendChild(after);
      }

      let items = Array.prototype.slice.call(track.querySelectorAll('.cust-image-card-grid__item'));
      const isMobile = () => window.matchMedia('(max-width: 767px)').matches;
      // The carousel runs on whichever breakpoints are configured to use it.
      const isActive = () => (isMobile() ? swipeOnMobile : carouselOnDesktop);
      const playbackMode = grid.dataset.videoPlayback || 'hover';
      const hasPointer = window.matchMedia('(hover: hover)').matches;
      // "Centre only" always follows the carousel; "hover" falls back to it on
      // touch devices, which have no pointer to hover with.
      const centreDrivesVideo = playbackMode === 'center' || (playbackMode === 'hover' && !hasPointer);

      let period = 0;
      let anchor = 0;
      let ticking = false;
      let activeReal = -1;
      let wrapping = false;
      let scrollIdleTimer = 0;
      let centreIndex = -1;

      const measure = () => {
        if (!canLoop) {
          return;
        }
        // One full set width, and the scroll offset that centres the first original.
        period = items[realCount].offsetLeft - items[0].offsetLeft;
        anchor = items[realCount].offsetLeft - (track.clientWidth - items[realCount].offsetWidth) / 2;
      };

      const setNavDisabled = (button, disabled) => {
        if (!button || button.disabled === disabled) {
          return;
        }
        button.classList.toggle('is-disabled', disabled);
        button.setAttribute('aria-disabled', disabled ? 'true' : 'false');
        button.disabled = disabled;
      };

      // One read pass, then one write pass — interleaving them would force a
      // synchronous layout per card on every scroll frame (visible as jitter).
      const offsets = new Array(items.length);
      const lastScale = new Array(items.length);

      const paint = () => {
        ticking = false;

        if (!isActive()) {
          items.forEach((item, index) => {
            item.style.transform = '';
            lastScale[index] = null;
          });
          return;
        }

        const rect = track.getBoundingClientRect();
        const center = rect.left + rect.width / 2;
        const range = rect.width * 0.62;
        let nearest = 0;
        let nearestDist = Infinity;

        for (let i = 0; i < items.length; i += 1) {
          const r = items[i].getBoundingClientRect();
          const offset = r.left + r.width / 2 - center;
          offsets[i] = offset;

          const distance = Math.abs(offset);
          if (distance < nearestDist) {
            nearestDist = distance;
            nearest = i;
          }
        }


        for (let i = 0; i < items.length; i += 1) {
          const distance = Math.min(Math.abs(offsets[i]), range);
          const scale = (1 - (1 - MIN_SCALE) * (distance / range)).toFixed(3);

          // Skip no-op writes; repainting a scaled <video> every frame flickers.
          // translateZ(0) keeps the scaling on the compositor instead of forcing
          // a repaint of the video surface, which is the other flicker source.
          if (lastScale[i] !== scale) {
            lastScale[i] = scale;
            items[i].style.transform = 'scale(' + scale + ') translateZ(0)';
          }
        }

        // Marks which card is centred, so CSS can give the others a shorter media
        // box. Only touched when the centre actually changes — it costs a layout.
        if (nearest !== centreIndex) {
          if (items[centreIndex]) {
            items[centreIndex].classList.remove('is-centre');
          }
          items[nearest].classList.add('is-centre');
          centreIndex = nearest;

          // Stop off-centre videos the moment they lose the centre, rather than
          // waiting for the scroll to settle. The loop jump happens mid-scroll,
          // and a card still playing at that instant would not match the first
          // frame its clone shows — which is exactly what flashes in the peek.
          // Starting the new centre still waits for the scroll to settle.
          if (centreDrivesVideo) {
            items.forEach((item, index) => {
              if (index !== nearest) {
                setCardPlaying(item, false);
              }
            });
          }
        }

        if (counter) {
          const real = ((nearest % realCount) + realCount) % realCount;
          if (real !== activeReal) {
            activeReal = real;
            counter.textContent = (real + 1) + ' / ' + realCount;
          }
        }

        // Without looping the track has real ends, so the arrows need to show them.
        if (!canLoop) {
          const maxScroll = Math.max(track.scrollWidth - track.clientWidth, 0);
          setNavDisabled(prevBtn, track.scrollLeft <= 4);
          setNavDisabled(nextBtn, track.scrollLeft >= maxScroll - 4);
        }
      };

      const nearestIndex = () => {
        const rect = track.getBoundingClientRect();
        const center = rect.left + rect.width / 2;
        let nearest = 0;
        let nearestDist = Infinity;

        for (let i = 0; i < items.length; i += 1) {
          const r = items[i].getBoundingClientRect();
          const distance = Math.abs(r.left + r.width / 2 - center);

          if (distance < nearestDist) {
            nearestDist = distance;
            nearest = i;
          }
        }

        return nearest;
      };

      // Keep the centred card in the middle of the strip by moving cards one at a
      // time from one end to the other, adjusting the scroll offset by exactly that
      // card's width. Nothing moves on screen.
      //
      // The previous approach jumped a whole set at once — roughly two viewports.
      // A jump that far lands on a region the browser has not rasterised yet, so it
      // paints the background first and fills in a frame or two later: the white
      // flash. Shifting by a single card stays inside painted territory. This also
      // only runs once scrolling has stopped, so it never fights a touchpad gesture
      // for the scroll position.
      const recentre = () => {
        if (!canLoop || wrapping || !isActive()) {
          return;
        }

        const target = Math.floor(items.length / 2);

        if (nearestIndex() === target) {
          return;
        }

        const styles = window.getComputedStyle(track);
        const gap = parseFloat(styles.columnGap || styles.gap || '0') || 0;

        // Mandatory scroll snapping re-snaps whenever the strip's contents change,
        // which cancels the offset we compensate the move with. The strip then
        // drifts back, gets re-centred again, and ping-pongs — restarting the
        // centre video on every bounce. Suspend snapping for the swap.
        const snapType = track.style.scrollSnapType;
        track.style.scrollSnapType = 'none';
        wrapping = true;

        let moved = false;

        for (let guard = 0; guard < items.length; guard += 1) {
          const nearest = nearestIndex();

          if (nearest === target) {
            break;
          }

          const forward = nearest > target;
          const node = forward ? track.firstElementChild : track.lastElementChild;

          if (!node) {
            break;
          }

          const width = node.offsetWidth + gap;

          if (forward) {
            track.appendChild(node);
            track.scrollLeft -= width;
          } else {
            track.insertBefore(node, track.firstElementChild);
            track.scrollLeft += width;
          }

          items = Array.prototype.slice.call(track.querySelectorAll('.cust-image-card-grid__item'));
          moved = true;
        }

        // Restore snapping a frame later, once the new offset has been committed.
        window.requestAnimationFrame(() => {
          track.style.scrollSnapType = snapType;
          wrapping = false;
        });

        if (!moved) {
          return;
        }

        // Card order changed, so the index-keyed caches no longer line up.
        items.forEach((item) => item.classList.remove('is-centre'));
        lastScale.length = 0;
        centreIndex = -1;
        paint();
      };

      // Video playback follows the centre card, but only once the carousel has
      // settled. Switching it every frame makes the videos strobe while scrolling.
      const syncCentreVideo = () => {
        if (!centreDrivesVideo || centreIndex < 0) {
          return;
        }

        items.forEach((item, index) => setCardPlaying(item, index === centreIndex));
      };

      // A card rendered while the section was set to autoplay keeps the autoplay
      // attribute, which the browser honours before any of this runs. Drop it so
      // the centre-only mode is the single source of truth.
      if (centreDrivesVideo) {
        items.forEach((item) => {
          Array.prototype.forEach.call(item.querySelectorAll('video'), (video) => {
            video.removeAttribute('autoplay');
          });
        });
      }

      // While the track moves, cards slide under a stationary cursor. Flagging the
      // grid lets CSS suspend hover zoom (and JS suspend hover video playback) so
      // they don't strobe on and off as each card passes by.
      const markScrolling = () => {
        if (!grid.classList.contains('is-scrolling')) {
          grid.classList.add('is-scrolling');
        }

        window.clearTimeout(scrollIdleTimer);
        scrollIdleTimer = window.setTimeout(() => {
          grid.classList.remove('is-scrolling');
          recentre();
          syncCentreVideo();

          // The cursor may have come to rest over a card without firing a fresh
          // mouseenter, so settle playback against whatever it is actually over.
          if (playbackMode === 'hover' && hasPointer) {
            items.forEach((item) => setCardPlaying(item, item.matches(':hover')));
          }
        }, 180);
      };

      const onScroll = () => {
        markScrolling();

        if (!ticking) {
          ticking = true;
          window.requestAnimationFrame(paint);
        }
      };

      const step = (direction) => {
        const ref = items[realCount] || items[0];
        const gap = parseFloat(window.getComputedStyle(track).columnGap || '0') || 0;
        const cardStep = ref.getBoundingClientRect().width + gap;
        track.scrollBy({ left: direction * cardStep, behavior: 'smooth' });
      };

      if (prevBtn) {
        prevBtn.classList.remove('is-disabled');
        prevBtn.setAttribute('aria-disabled', 'false');
        prevBtn.disabled = false;
        prevBtn.addEventListener('click', () => step(-1));
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', () => step(1));
      }

      track.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', () => {
        measure();
        onScroll();
      }, { passive: true });

      // Start centred on the first original once layout is ready.
      window.requestAnimationFrame(() => {
        measure();
        if (canLoop && isActive()) {
          track.scrollLeft = anchor;
        }
        window.requestAnimationFrame(() => {
          paint();
          syncCentreVideo();
        });
      });
    });
  };

  // Videos bind last so loop clones created by the carousel get handlers too.
  document.addEventListener('DOMContentLoaded', () => {
    initImageCardGridNav();
    initHoverRevealHeight();
    initHoverRevealCarousel();
    initCardVideos();
  });

  document.addEventListener('shopify:section:load', (event) => {
    initImageCardGridNav(event.target);
    initHoverRevealHeight(event.target);
    initHoverRevealCarousel(event.target);
    initCardVideos(event.target);
  });
})();