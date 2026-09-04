/**
 *  @class
 *  @function SlideShow
 */
if (!customElements.get('slide-show')) {
  class SlideShow extends HTMLElement {
    constructor() {
      super();
      const slideshow = this;

      let dots = slideshow.dataset.dots === 'true',
        slideshow_slides = Array.from(slideshow.querySelectorAll('.carousel__slide')),
        autoplay = slideshow.dataset.autoplay == 'false' ? false : parseInt(slideshow.dataset.autoplay, 10),
        align = slideshow.dataset.align == 'center' ? 'center' : 'left',
        fade = slideshow.dataset.fade == 'true' ? true : false,
        prev_button = slideshow.querySelector('.flickity-prev'),
        next_button = slideshow.querySelector('.flickity-next'),
        custom_dots = slideshow.querySelector('.flickity-page-dots'),
        progress_bar = slideshow.parentNode.querySelector('.flickity-progress--bar'),
        animations = [],
        rightToLeft = document.dir === 'rtl',
        animations_enabled = document.body.classList.contains('animations-true') && typeof gsap !== 'undefined',
        scroll_mode = slideshow.dataset.scrollMode,
        selectedIndex = 0,
        args = {
          wrapAround: true,
          cellAlign: align,
          pageDots: false,
          contain: true,
          fade: fade,
          autoPlay: autoplay,
          rightToLeft: rightToLeft,
          prevNextButtons: false,
          cellSelector: '.carousel__slide',
          on: {}
        };

      if (slideshow_slides.length < 1) {
        return;
      }
      if (slideshow.classList.contains('image-with-text-slideshow__image')) {
        let main_slideshow = slideshow.parentNode.querySelector('.image-with-text-slideshow__content'),
          image_slideshow_slides = slideshow.querySelectorAll('.image-with-text-slideshow__image-media');
        args.draggable = false;
        args.asNavFor = main_slideshow;

        if (image_slideshow_slides.length) {
          if (image_slideshow_slides[0].classList.contains('desktop-height-auto')) {
            args.adaptiveHeight = true;
          }
        }
      }
      if (slideshow.classList.contains('customer-reviews__image')) {
        let main_slideshow = slideshow.parentNode.querySelector('.customer-reviews__content');
        args.draggable = false;
        args.asNavFor = main_slideshow;
      }
      if (slideshow.classList.contains('image-with-text-slideshow__content') ||
        slideshow.classList.contains('testimonials__carousel') ||
        slideshow.classList.contains('customer-reviews__content') ||
        slideshow.classList.contains('customer-reviews__image')) {
        args.adaptiveHeight = true;
      }
      if (slideshow.classList.contains('custom-dots')) {

        if (animations_enabled && slideshow.classList.contains('main-slideshow')) {
          this.prepareAnimations(slideshow, animations);
        }
        args.pauseAutoPlayOnHover = false;

        args.on = {
          staticClick: function () {
            this.unpausePlayer();
          },
          ready: function () {
            let flkty = this;
            // Animations.
            if (animations_enabled && slideshow.classList.contains('main-slideshow')) {
              slideshow.animateSlides(0, animations);
              gsap.set(slideshow.querySelectorAll('.subheading,.split-text,.button'), { visibility: 'visible' });
            }

            // Custom Dots.
            if (dots && custom_dots) {
              let dots = custom_dots.querySelectorAll('li');
              dots.forEach((dot, i) => {
                dot.addEventListener('click', (e) => {
                  flkty.select(i);
                });
              });
              dots[this.selectedIndex].classList.add('is-selected');
            }
            document.fonts.ready.then(function () {
              flkty.resize();
            });

            // Video Support.
            let video_container = flkty.cells[0].element.querySelector('.slideshow__slide-video-bg');
            if (video_container) {

              if (video_container.querySelector('iframe')) {
                video_container.querySelector('iframe').onload = function () {
                  slideshow.videoPlay(video_container);
                };
              } else if (video_container.querySelector('video')) {
                // 要求首屏视频尽快开播、且视频不能再压缩：改为「海报画出后立刻开始加载播放」，
                // 不再等 window.load + 空闲（那会把开播拖到约 4s）。首屏 hosted 视频仍是 preload="none" + data-src，
                // 双 rAF 保证海报（第一帧）先画出、不阻塞首帧，随后马上激活当前可见的那个容器（桌面/移动二选一），
                // 只加载可见的一份、避免双份下载。
                const startHeroVideo = function () {
                  const containers = flkty.cells[0].element.querySelectorAll('.slideshow__slide-video-bg');
                  const visible = Array.prototype.find.call(containers, function (c) {
                    return c.offsetParent !== null;
                  }) || video_container;
                  slideshow.videoPlay(visible);
                };
                requestAnimationFrame(function () {
                  requestAnimationFrame(startHeroVideo);
                });

              }
            }
          },
          change: function (index) {
            let previousIndex = fizzyUIUtils.modulo(this.selectedIndex - 1, this.slides.length);

            // Animations.
            if (animations_enabled && slideshow.classList.contains('main-slideshow')) {
              setTimeout(() => {
                slideshow.animateReverse(previousIndex, animations);
              }, 300);
              slideshow.animateSlides(index, animations);
            }

            // Custom Dots.
            if (dots && custom_dots) {
              let dots = custom_dots.querySelectorAll('li');
              dots.forEach((dot, i) => {
                dot.classList.remove('is-selected');
              });
              dots[this.selectedIndex].classList.add('is-selected');
            }

            // AutoPlay
            if (autoplay) {
              this.stopPlayer();
              this.playPlayer();
            }

            // Video Support.
            // 只操作当前可见的视频容器（桌面/移动二选一），避免激活隐藏的另一份导致双份下载。
            const pickVisibleVideoBg = function (cell) {
              const containers = cell.querySelectorAll('.slideshow__slide-video-bg');
              return Array.prototype.find.call(containers, function (c) {
                return c.offsetParent !== null;
              }) || containers[0];
            };
            // previous slide
            let video_container_prev = pickVisibleVideoBg(flkty.cells[previousIndex].element);
            if (video_container_prev) {
              slideshow.videoPause(video_container_prev);
            }
            // current slide
            let video_container = pickVisibleVideoBg(flkty.cells[index].element);
            if (video_container) {
              if (video_container.querySelector('iframe')) {
                if (video_container.querySelector('iframe').classList.contains('lazyload')) {
                  video_container.querySelector('iframe').addEventListener('lazybeforeunveil', slideshow.videoPlay(video_container));
                  lazySizes.loader.checkElems();
                } else {
                  slideshow.videoPlay(video_container);
                }
              } else if (video_container.querySelector('video')) {
                slideshow.videoPlay(video_container);
              }
            }

          }
        };
      }
      if (slideshow.classList.contains('main-slideshow')) {
        if (slideshow.classList.contains('desktop-height-image') || slideshow.classList.contains('mobile-height-image')) {
          args.adaptiveHeight = true;
        }
      }
      if (scroll_mode === 'loop') {
        args.wrapAround = true;
      } else if (scroll_mode === 'group') {
        args.wrapAround = false;
        args.groupCells = true;
      } else if (scroll_mode === 'single') {
        args.wrapAround = false;
      } else if (slideshow.classList.contains('products')) {
        args.wrapAround = false;
        args.on.ready = function () {
          var flickity = this;
          if (next_button) {
            window.addEventListener('resize', function () {
              slideshow.centerArrows(flickity, prev_button, next_button);
            });
          }
          window.dispatchEvent(new Event('resize'));
        };
      }
      if (progress_bar) {
        args.wrapAround = false;
        args.on.scroll = function (progress) {
          progress = Math.max(0, Math.min(1, progress));

          progress_bar.style.width = progress * 100 + '%';

        };
      }
      const flkty = new Flickity(slideshow, args);

      selectedIndex = flkty.selectedIndex;

      slideshow.dataset.initiated = true;

      const needs_editor_layout_sync = slideshow.classList.contains('cust-image-carousel__track');
      const syncCarouselLayout = () => {
        if (!needs_editor_layout_sync) {
          return;
        }
        requestAnimationFrame(() => {
          flkty.reloadCells();
          flkty.resize();
          flkty.reposition();
          updateNavState();
        });
      };

      const syncCarouselLayoutDelayed = () => {
        if (!needs_editor_layout_sync) {
          return;
        }
        syncCarouselLayout();
        setTimeout(syncCarouselLayout, 80);
        setTimeout(syncCarouselLayout, 220);
      };

      if (needs_editor_layout_sync) {
        slideshow.querySelectorAll('img').forEach((image) => {
          if (image.complete) {
            return;
          }
          image.addEventListener('load', syncCarouselLayout, { once: true });
        });
      }

      const getSingleStepIndices = () => {
        if (!flkty.slides || !flkty.slides.length) {
          return [0];
        }

        const tolerance = 0.5;
        const step_indices = [];

        for (let i = 0; i < flkty.slides.length; i++) {
          const previous_step_index = step_indices[step_indices.length - 1];
          const previous_target = flkty.slides[previous_step_index]?.target;
          const current_target = flkty.slides[i].target;

          if (previous_target === undefined || Math.abs(current_target - previous_target) > tolerance) {
            step_indices.push(i);
          }
        }

        return step_indices.length ? step_indices : [0];
      };

      const getSingleStepPosition = (selected_index = flkty.selectedIndex) => {
        const step_indices = getSingleStepIndices();
        const normalized_index = Math.min(Math.max(selected_index ?? 0, 0), Math.max((flkty.slides?.length || 1) - 1, 0));
        const selected_target = flkty.slides?.[normalized_index]?.target;

        if (selected_target === undefined) {
          return 0;
        }

        let closest_position = 0;
        let closest_distance = Infinity;

        step_indices.forEach((step_index, position) => {
          const distance = Math.abs((flkty.slides?.[step_index]?.target ?? 0) - selected_target);

          if (distance < closest_distance) {
            closest_distance = distance;
            closest_position = position;
          }
        });

        return closest_position;
      };

      const selectSingleStepPosition = (position) => {
        const step_indices = getSingleStepIndices();
        const max_position = Math.max(step_indices.length - 1, 0);
        const target_position = Math.min(Math.max(position, 0), max_position);
        const target_index = step_indices[target_position] ?? 0;

        single_step_position = target_position;
        updateNavState();

        if (flkty.selectedIndex !== target_index) {
          flkty.select(target_index);
        }
      };

      const use_single_step_navigation = !flkty.options.wrapAround && !flkty.options.groupCells;
      let single_step_position = use_single_step_navigation ? getSingleStepPosition() : 0;

      const updateNavState = () => {
        if (!prev_button || !next_button) {
          return;
        }

        if (flkty.options.wrapAround) {
          prev_button.classList.remove('is-disabled');
          next_button.classList.remove('is-disabled');
          prev_button.setAttribute('aria-disabled', 'false');
          next_button.setAttribute('aria-disabled', 'false');
          return;
        }

        let current_index = flkty.selectedIndex ?? 0;
        let max_index = Math.max((flkty.slides?.length || 1) - 1, 0);

        if (use_single_step_navigation) {
          max_index = Math.max(getSingleStepIndices().length - 1, 0);
          current_index = Math.min(single_step_position ?? 0, max_index);
        }

        const at_start = current_index <= 0;
        const at_end = current_index >= max_index;

        prev_button.classList.toggle('is-disabled', at_start);
        next_button.classList.toggle('is-disabled', at_end);
        prev_button.setAttribute('aria-disabled', at_start ? 'true' : 'false');
        next_button.setAttribute('aria-disabled', at_end ? 'true' : 'false');
      };

      const syncSingleStepIndex = () => {
        if (!use_single_step_navigation) {
          updateNavState();
          return;
        }

        single_step_position = getSingleStepPosition();
        updateNavState();
      };

      const moveSingleStep = (direction) => {
        const max_position = Math.max(getSingleStepIndices().length - 1, 0);
        const current_position = Math.min(Math.max(single_step_position ?? getSingleStepPosition(), 0), max_position);
        const target_position = direction === 'prev' ? current_position - 1 : current_position + 1;

        if (target_position < 0 || target_position > max_position) {
          updateNavState();
          return;
        }

        selectSingleStepPosition(target_position);
      };


      if (prev_button) {
        prev_button.addEventListener('click', (event) => {
          if (prev_button.classList.contains('is-disabled')) {
            return;
          }
          if (use_single_step_navigation) {
            moveSingleStep('prev');
            return;
          }
          flkty.previous();
        });
        prev_button.addEventListener('keyup', (event) => {
          if (prev_button.classList.contains('is-disabled')) {
            return;
          }
          if (use_single_step_navigation) {
            moveSingleStep('prev');
            return;
          }
          flkty.previous();
        });
        next_button.addEventListener('click', (event) => {
          if (next_button.classList.contains('is-disabled')) {
            return;
          }
          if (use_single_step_navigation) {
            moveSingleStep('next');
            return;
          }
          flkty.next();
        });
        next_button.addEventListener('keyup', (event) => {
          if (next_button.classList.contains('is-disabled')) {
            return;
          }
          if (use_single_step_navigation) {
            moveSingleStep('next');
            return;
          }
          flkty.next();
        });
      }
      if (use_single_step_navigation) {
        flkty.on('change', syncSingleStepIndex);
        flkty.on('settle', syncSingleStepIndex);
        window.addEventListener('resize', debounce(syncSingleStepIndex, 100), { passive: true });
        requestAnimationFrame(syncSingleStepIndex);
        window.addEventListener('load', syncSingleStepIndex, { once: true, passive: true });
      } else {
        flkty.on('change', updateNavState);
        flkty.on('settle', updateNavState);
        updateNavState();
      }
      if (Shopify.designMode) {
        slideshow.addEventListener('shopify:block:select', (event) => {
          let index = slideshow_slides.indexOf(event.target);
          flkty.select(index);
          syncCarouselLayoutDelayed();
        });
        if (needs_editor_layout_sync) {
          document.addEventListener('shopify:section:load', (event) => {
            if (event.target && event.target.contains(slideshow)) {
              syncCarouselLayoutDelayed();
            }
          });
        }
      }

      syncCarouselLayoutDelayed();

    }
    videoPause(video_container) {
      setTimeout(() => {
        if (video_container.dataset.provider === 'hosted') {
          video_container.querySelector('video').pause();
        } else if (video_container.dataset.provider === 'youtube') {
          video_container.querySelector('iframe').contentWindow.postMessage(JSON.stringify({
            event: "command",
            func: "pauseVideo",
            args: ""
          }), "*");
        } else if (video_container.dataset.provider === 'vimeo') {
          video_container.querySelector('iframe').contentWindow.postMessage(JSON.stringify({
            method: "pause"
          }), "*");
        }
      }, 10);
    }
    activateHostedVideo(video) {
      // 延迟加载：首次播放前，把 <source data-src> 挂到 src 并 load()，触发下载。
      if (!video || video.dataset.activated) return;
      const sources = video.querySelectorAll('source[data-src]');
      if (!sources.length) return;
      sources.forEach((s) => {
        if (!s.getAttribute('src')) s.setAttribute('src', s.dataset.src);
      });
      video.dataset.activated = 'true';
      video.load();
    }
    videoPlay(video_container) {
      setTimeout(() => {
        if (video_container.dataset.provider === 'hosted') {
          const video = video_container.querySelector('video');
          if (!video) return;
          this.activateHostedVideo(video);
          video.play();
        } else if (video_container.dataset.provider === 'youtube') {
          video_container.querySelector('iframe').contentWindow.postMessage(JSON.stringify({
            event: "command",
            func: "playVideo",
            args: ""
          }), "*");
        } else if (video_container.dataset.provider === 'vimeo') {
          video_container.querySelector('iframe').contentWindow.postMessage(JSON.stringify({
            method: "play"
          }), "*");
        }
      }, 10);
    }
    prepareAnimations(slideshow, animations) {
      if (!slideshow.dataset.animationsReady) {
        new SplitText(slideshow.querySelectorAll('h1, p:not(.subheading)'), {
          type: 'lines, words',
          linesClass: 'line-child'
        });
        slideshow.querySelectorAll('.slideshow__slide').forEach((item, i) => {
          let tl = gsap.timeline({
            paused: true
          }),
            button_offset = 0;

          animations[i] = tl;

          if (slideshow.dataset.transition == 'swipe') {
            tl
              .to(item, {
                duration: item.classList.contains('is-initial-selected') ? 0.2 : 0.7,
                clipPath: "polygon(100% 0, 0 0, 0 100%, 100% 100%)"
              }, "start");
          }
          tl
            .to(item.querySelector('.slideshow__slide-bg'), {
              duration: 1.5,
              scale: 1
            }, "start");

          if (item.querySelector('.subheading')) {
            tl
              .to(item.querySelector('.subheading'), {
                duration: 0.5,
                autoAlpha: 1
              }, 0);

            button_offset += 0.5;
          }
          if (item.querySelector('h1')) {
            let h1_duration = 0.5 + ((item.querySelectorAll('h1 .line-child div').length - 1) * 0.05);
            tl
              .from(item.querySelectorAll('h1 .line-child div'), {
                duration: h1_duration,
                yPercent: '100',
                stagger: 0.05
              }, 0);
            button_offset += h1_duration;
          }
          if (item.querySelector('p:not(.subheading)')) {

            let p_duration = 0.5 + ((item.querySelectorAll('p:not(.subheading) .line-child div').length - 1) * 0.02);
            tl
              .from(item.querySelectorAll('p:not(.subheading) .line-child div'), {
                duration: p_duration,
                yPercent: '100',
                stagger: 0.02
              }, 0);
            button_offset += p_duration;
          }
          if (item.querySelectorAll('.button')) {
            tl
              .fromTo(item.querySelectorAll('.button'), {
                y: '100%'
              }, {
                duration: 0.5,
                y: '0%',
                stagger: 0.1,
              }, button_offset * 0.2);
          }
          item.dataset.timeline = tl;
        });
        slideshow.dataset.animationsReady = true;
      }
    }
    animateSlides(i, animations) {
      document.fonts.ready.then(function () {
        animations[i].timeScale(1).restart();
      });
    }
    animateReverse(i, animations) {
      animations[i].timeScale(3).reverse();
    }
    centerArrows(flickity, prev_button, next_button) {
      let first_cell = flickity.cells[0],
        max_height = 0,
        image_height;
      if(first_cell.element.querySelector('.product-featured-image')){
        image_height = first_cell.element.querySelector('.product-featured-image').clientHeight;
        
    }
      // console.log(first_cell.element.querySelector('.product-featured-image'));

      

      flickity.cells.forEach((item, i) => {
        
        
        if (item.size.height > max_height) {
          max_height = item.size.height;
        }
      });


      if (max_height > image_height) {
        let difference = (max_height - image_height) / -2;

        prev_button.style.transform = 'translateY(' + difference + 'px)';
        next_button.style.transform = 'translateY(' + difference + 'px)';
      }
    }
  }
  customElements.define('slide-show', SlideShow);
}
