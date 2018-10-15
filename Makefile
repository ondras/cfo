ALL := app/app.js app/app.css \
		settings/settings.js settings/settings.css \
		progress/progress.js progress/progress.css \
		issue/issue.js issue/issue.css \
		viewer/text/viewer.js viewer/text/viewer.css \
		viewer/image/viewer.js viewer/image/viewer.css \
		viewer/av/viewer.js viewer/av/viewer.css
JS := $(shell find src/js -name '*.js')
CSS := $(shell find src/css -name '*.less')
TESTS := $(shell find tests/src -name '*.js' | sed -e s^/src^^)
ROLLUP := npm -s run rollup -- -c src/rollup.config.js
LESSC := npm -s run lessc --

all: $(ALL)

app/app.js: $(JS)
	$(ROLLUP) src/js/app.js -o $@

app/app.css: $(CSS)
	$(LESSC) src/css/app.less > $@

settings/settings.js: $(JS)
	$(ROLLUP) src/js/settings/local.js -o $@

settings/settings.css: $(CSS)
	$(LESSC) src/css/settings.less > $@

progress/progress.js: $(JS)
	$(ROLLUP) src/js/progress/local.js -o $@

progress/progress.css: $(CSS)
	$(LESSC) src/css/progress.less > $@

issue/issue.js: $(JS)
	$(ROLLUP) src/js/issue/local.js -o $@

issue/issue.css: $(CSS)
	$(LESSC) src/css/issue.less > $@

viewer/%/viewer.js: $(JS)
	$(ROLLUP) src/js/viewer/$*/local.js -o $@

viewer/%/viewer.css: $(CSS)
	$(LESSC) src/css/viewer/$*.less > $@

icons:
	cd ~/git/numix-icon-theme && git pull
	rsync -r -l ~/git/numix-icon-theme/Numix/16/ img/numix/
	cd ~/git/faenza-icon-theme && git pull
	rsync -r -l ~/git/faenza-icon-theme/Faenza/ img/faenza/
	find img/faenza -type l -or -type f | grep -v 16 | xargs rm

$(TESTS): tests/%: tests/src/% $(JS) tests/index.js tests/test-utils.js
	npm -s run rollup -- -c tests/rollup.config.js $< -o $@

tests: $(TESTS)

clean:
	rm -rf $(ALL)

.PHONY: all clean icons tests
