<script>
let audio;

$effect(() => {
  if (audio) {
    audio.loop = true;
    audio.volume = 0.5; // Set to 50% volume by default
    
    // Start playing when component mounts
    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.log("Autoplay prevented:", error);
      });
    }
  }
});
</script>

<audio 
  bind:this={audio} 
  src="/audio.mp3"
  preload="auto"
>
  <track kind="captions" />
</audio> 