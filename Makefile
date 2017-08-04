ALL := app/app.js app/app.css \
		progress/progress.js progress/progress.css \
		issue/issue.js issue/issue.css \
		viewer/text/text.js viewer/text/text.css \
		viewer/image/image.js viewer/image/image.css
JS := $(shell find src/js -name '*.js')
CSS := $(shell find src/css -name '*.less')
ROLLUP := npm -s run rollup -- -c src/rollup.config.js
LESSC := npm -s run lessc --

all: $(ALL)

app/app.js: $(JS)
	$(ROLLUP) src/js/app.js -o $@

app/app.css: $(CSS)
	$(LESSC) src/css/app.less > $@

progress/progress.js: $(JS)
	$(ROLLUP) src/js/progress/local.js -o $@

progress/progress.css: $(CSS)
	$(LESSC) src/css/progress.less > $@

issue/issue.js: $(JS)
	$(ROLLUP) src/js/issue/local.js -o $@

issue/issue.css: $(CSS)
	$(LESSC) src/css/issue.less > $@

viewer/text/text.js: $(JS)
	$(ROLLUP) src/js/viewer/text/local.js -o $@

viewer/image/image.js: $(JS)
	$(ROLLUP) src/js/viewer/image/local.js -o $@

viewer/text/text.css: $(CSS)
	$(LESSC) src/css/viewer/text.less > $@

viewer/image/image.css: $(CSS)
	$(LESSC) src/css/viewer/image.less > $@

clean:
	rm -rf $(ALL)

.PHONY: all clean
