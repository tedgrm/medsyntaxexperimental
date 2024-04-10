function grayscaleFunction() {
    for (var i = 0; i < rad.length; i++) {
        rad[i].addEventListener('change', function () {
            // (prev) ? console.log(prev.value) : null;
            if (this !== prev) {
                prev = this;
            }
            if (this.value == 1) {
                // console.log(this.value)
                $("#search-string").css("filter", "");
                grayscale = false;
            } else if (this.value == 2) {
                // console.log(this.value)
                $("#search-string").css("filter", "grayscale(100%)");
                grayscale = true;
            }
        });
    }
}