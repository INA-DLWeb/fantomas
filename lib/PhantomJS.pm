package PhantomJS;

use strict;
use warnings;
use Carp;
use Config;
use Cwd;
use JSON::XS qw(decode_json);
use List::Pairwise qw(mapp grepp);

use enum::fields qw(
	CMD
);

use constant PREFIX => 'bin/phantomjs-impl/';
use constant SUFFIX => '/bin/phantomjs';
my $PJS_PATH = _get_abs_resource(PREFIX . _get_bin_name() . SUFFIX);

sub new {
	my $class = shift;
	my $js_path = shift;

	my %args = (
		'proxy'	=> undef,
		'disk-cache' => 'no',
		'load-images' => 'yes',
		#'load-plugins' => 'yes',
		'ignore-ssl-errors' => 'yes',
		'web-security' => 'no',
		'max-disk-cache-size' => 0,
		@_
	);
	
	my $self = bless [], $class;
	
	croak "cannot find executable PhantomJS binary at '$PJS_PATH'" unless -x $PJS_PATH;
	
	$self->[CMD] = sprintf(q!%s %s '%s' %%s 2>/dev/null!,
		$PJS_PATH,
		(join ' ', mapp {"--$a=$b"} grepp {defined $b} %args),
		$js_path,
	);
	
	$self
}

sub open {
	my $self = shift;
	
	my $script_args = join ' ', map { "'$_'" } grep {defined} @_;
	my $cmd = sprintf($self->[CMD], $script_args);
	# print "$cmd\n";
	my $pjs_pid = CORE::open(my $pjs_fh, "-|", $cmd) || croak $!;	
	# print "started PhantomJS ($pjs_pid)\n";
	
	my $kill = sub {
		# close $pjs_fh;
		#my $killed = kill 9, $pjs_pid; # process-only (does not kill sub-processes)
		#my $killed = kill -9, $pjs_pid; # process-group (win32 only)
		my $killed = `pkill -KILL -P $pjs_pid`;
		print "Killed PhantomJS (pid: ", $pjs_pid // "undef", ") : $killed\n";
	};
	
	my $error = 0;
	
	return {
		# read next line on filehandler
		next => sub {{
			my $line = <$pjs_fh>;
			
			# if line is undefined, it means that the pipe was closed
			if (not defined $line) {
				warn "PhantomJS stopped in an unexpected way. Command was:\n[$cmd]";
				return undef
			}
			chomp $line;
			# print ":: $line\n";
			
			# if the line is in JSON format, decode it
			if ($line =~ /^\{/) {
				my $result = decode_json($line);
				
				# end signal
				if ($result->{type} eq 'exit') {
					
					# exit had error
					if ($result->{reason} ne 'done') {
						$error = $result->{reason};
					}
					$kill->();
					return undef
				} elsif ($result->{type} eq 'message') {
					print "Fantomas: '", $result->{message}, "'\n";
					redo; 
				}
				
				return $result;
			} 
			
			# if not in JSON format, recall the current block ({{}}) to skip the current line without recursion
			else {
				#print "$line\n";
				redo
			}
		}},
		
		error => sub { return $error; },
		
		# kill PhantomJS
		kill => $kill,
		
		pid => $pjs_pid,		
	}
}

sub _get_abs_resource {
	my $path = shift;
	return $path if $path =~ m!^/!;
	require Cwd;
	(my $dir = __FILE__) =~ s![^/]+$!!;
	(my $cwd = Cwd::getcwd()) =~ s!/$!!;
	my @dirs = grep {length} split(/\//, "$cwd/$dir");
	my @path = grep {length} split(/\//, $path);
	
	while (local $_ = shift @path) {
		pop @dirs, next if /^..$/;
		next if /^.$/;
		return join('/', '', @dirs, $_, @path);
	}
}

sub _get_bin_name {
	my $os = "$^O";
	my $x64 = '#';
	
	if ($os =~ m/linux/i) {
		# linux
		$x64 = "$Config{archname}" =~ m/x86_64/;
	} else {
		# windows or mac
		die "$os : not implemented";
	}
	
	return "phantomjs-$os-" . ($x64 ? "64" : "32");
}

# EOF
1
