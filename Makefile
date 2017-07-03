ALL := app.js app.css progress.js progress.css issue.js issue.css
JS := $(shell find src/js -name '*.js')
ROLLUP := npm -s run rollup -- -c src/rollup.config.js
LESSC := npm -s run lessc --

all: $(ALL)

app.js: $(JS)
	$(ROLLUP) src/js/app.js -o $@

app.css: src/css/*
	$(LESSC) src/css/app.less > $@

progress.js: $(JS)
	$(ROLLUP) src/js/progress.js -o $@

progress.css: src/css/*
	$(LESSC) src/css/progress.less > $@

issue.js: $(JS)
	$(ROLLUP) src/js/issue.js -o $@

issue.css: src/css/*
	$(LESSC) src/css/issue.less > $@

clean:
	rm -rf $(ALL)

.PHONY: all clean
