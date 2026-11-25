let grayscale = false;
const rad = document.myForm.myRadios;
let prev = null;
for (let i = 0; i < rad.length; i++) {
    // console.log('rad:', rad[i].value);
    rad[i].addEventListener('change', function () {
        if (this !== prev) {
            prev = this;
        }
        if (this.value === '1') {
            // console.log(this.value)
            $("#search-string").css("filter", "");
            grayscale = false;
        } else if (this.value === '2') {
            // console.log(this.value)
            $("#search-string").css("filter", "grayscale(100%)");
            grayscale = true;
        }
    });
}
